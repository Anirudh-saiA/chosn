import type { IncomingMessage } from 'node:http';
import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection } from '@nestjs/websockets';
import Redis from 'ioredis';
import type { WebSocket } from 'ws';
import type { Server } from 'ws';
import { verifyApiToken, type ApiJwtPayload } from '../auth/api-jwt';
import { REDIS_CLIENT } from '../common/redis.provider';
import { bullConnection } from '../queue/queue.config';
import { CHAT_BROADCAST_CHANNEL, isChatBroadcastEvent } from '../trust-safety/chat-events.pubsub';
import { isModerationRetractEvent, MODERATION_RETRACT_CHANNEL } from '../trust-safety/moderation-events.pubsub';
import { BlocksService } from '../trust-safety/blocks.service';
import { ChatMessagesService } from './chat-messages.service';
import { ChatRoomsService } from './chat-rooms.service';

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_PER_MINUTE = 10;

/** Same WeakMap-keyed-by-socket identity pattern as DropLiveGateway — see that file's own doc comment, which flagged this exact reuse ("a future user-scoped broadcast... community chat") ahead of it existing. */
const connectionIdentity = new WeakMap<WebSocket, ApiJwtPayload>();
/** Which rooms each socket has joined — cleared on disconnect so a closed connection can't linger as a phantom room member. */
const socketRooms = new WeakMap<WebSocket, Set<string>>();
/** The room membership itself — the actual per-room broadcast targets task 5 asks for, unlike DropLiveGateway's single global room. */
const roomMembers = new Map<string, Set<WebSocket>>();

interface IncomingChatFrame {
  type: 'chat:join' | 'chat:leave' | 'chat:send';
  roomId?: string;
  body?: string;
}

function isIncomingChatFrame(value: unknown): value is IncomingChatFrame {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as IncomingChatFrame).type === 'string' &&
    ['chat:join', 'chat:leave', 'chat:send'].includes((value as IncomingChatFrame).type)
  );
}

/**
 * Task 5/6: per-drop chat rooms extending the Day 14 WebSocket
 * infrastructure — same `ws` library, same connection-auth-via-query-
 * token pattern, same per-client try/catch broadcast discipline as
 * DropLiveGateway, applied to room-scoped rather than global broadcast
 * (chat genuinely needs "only this drop's room," unlike a drop-status
 * flip that's cheap to send everyone). A separate gateway/path
 * (`/ws/chat`) rather than folding into DropLiveGateway itself — that
 * class's whole shape is "one global broadcast of one event type from
 * Redis pub/sub," and chat's bidirectional, room-scoped, rate-limited
 * traffic is a different enough concern to keep as its own class, the
 * same way DropsModule already keeps DropLiveGateway/DropPushConsumer/
 * DropNewsAutoPostService as separate single-purpose classes rather than
 * one that does everything.
 */
@WebSocketGateway({ path: '/ws/chat' })
export class ChatGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  private moderationSubscriber?: Redis;

  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly rooms: ChatRoomsService,
    private readonly messages: ChatMessagesService,
    private readonly blocks: BlocksService,
  ) {}

  /**
   * Day 23 fix: an admin actioning a message-type report in
   * /admin/reports now sets `is_removed = true` on that row (see
   * ReportsService.hideEntity), but a viewer already connected to the
   * room wouldn't see that until their next history fetch. Same
   * dedicated-subscriber pattern as DropLiveGateway (a subscribed
   * ioredis connection can't issue other commands, and this consumer
   * must stay independent of the request-path REDIS_CLIENT above) —
   * on a retraction event, broadcast the same `chat:retract` frame the
   * classifier's own auto-flag path already sends, so the client-side
   * handling is identical regardless of which review path caused it.
   *
   * Day 26: the same subscriber connection also carries
   * CHAT_BROADCAST_CHANNEL — every `chat:send` now publishes here
   * instead of calling `broadcastToRoom` directly (see `send()` below),
   * so a message from a client on one Railway instance still reaches a
   * room-mate connected to a different instance. One subscriber
   * connection for both channels, branched on `channel`, rather than a
   * second Redis connection — ioredis subscriptions are cheap to add to
   * an existing subscriber, and this class already established the
   * "one dedicated subscriber, can't issue other commands" constraint.
   */
  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — chat moderation-retraction subscriber not started');
      return;
    }
    this.moderationSubscriber = new Redis(bullConnection());
    await this.moderationSubscriber.subscribe(MODERATION_RETRACT_CHANNEL, CHAT_BROADCAST_CHANNEL);
    this.moderationSubscriber.on('message', (channel, message) => {
      if (channel === MODERATION_RETRACT_CHANNEL) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(message);
        } catch {
          this.logger.error(`malformed ${MODERATION_RETRACT_CHANNEL} payload, not JSON: ${message.slice(0, 200)}`);
          return;
        }
        if (!isModerationRetractEvent(parsed)) {
          this.logger.error(`malformed ${MODERATION_RETRACT_CHANNEL} payload, missing fields: ${message.slice(0, 200)}`);
          return;
        }
        this.broadcastToRoom(parsed.roomId, { type: 'chat:retract', roomId: parsed.roomId, messageId: parsed.messageId });
        return;
      }

      if (channel === CHAT_BROADCAST_CHANNEL) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(message);
        } catch {
          this.logger.error(`malformed ${CHAT_BROADCAST_CHANNEL} payload, not JSON: ${message.slice(0, 200)}`);
          return;
        }
        if (!isChatBroadcastEvent(parsed)) {
          this.logger.error(`malformed ${CHAT_BROADCAST_CHANNEL} payload, missing fields: ${message.slice(0, 200)}`);
          return;
        }
        this.broadcastToRoom(parsed.roomId, parsed.payload, parsed.excludedRecipients);
      }
    });
    this.moderationSubscriber.on('error', (err) => {
      this.logger.error(`moderation-retraction/chat-broadcast subscriber error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.moderationSubscriber?.quit();
  }

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const url = new URL(request.url ?? '', 'http://internal');
    const token = url.searchParams.get('token');
    if (token) {
      const identity = verifyApiToken(token);
      if (identity) {
        connectionIdentity.set(client, identity);
      } else {
        this.logger.warn('invalid/expired chat token on connect — continuing as anonymous (read-only)');
      }
    }

    socketRooms.set(client, new Set());

    client.on('message', (raw: Buffer) => {
      void this.handleMessage(client, raw);
    });

    client.on('close', () => {
      const joined = socketRooms.get(client);
      if (joined) {
        for (const roomId of joined) roomMembers.get(roomId)?.delete(client);
      }
      socketRooms.delete(client);
    });
  }

  private async handleMessage(client: WebSocket, raw: Buffer): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return; // malformed frame — silently ignored, same as DropLiveGateway's malformed-pubsub-payload handling
    }
    if (!isIncomingChatFrame(parsed)) return;

    if (parsed.type === 'chat:join' && parsed.roomId) {
      this.join(client, parsed.roomId);
    } else if (parsed.type === 'chat:leave' && parsed.roomId) {
      this.leave(client, parsed.roomId);
    } else if (parsed.type === 'chat:send' && parsed.roomId) {
      await this.send(client, parsed.roomId, parsed.body ?? '');
    }
  }

  private join(client: WebSocket, roomId: string): void {
    (roomMembers.get(roomId) ?? roomMembers.set(roomId, new Set()).get(roomId)!).add(client);
    socketRooms.get(client)?.add(roomId);
  }

  private leave(client: WebSocket, roomId: string): void {
    roomMembers.get(roomId)?.delete(client);
    socketRooms.get(client)?.delete(roomId);
  }

  private sendError(client: WebSocket, message: string): void {
    if (client.readyState !== client.OPEN) return;
    try {
      client.send(JSON.stringify({ type: 'chat:error', message }));
    } catch {
      /* client already gone — nothing to do */
    }
  }

  /**
   * Task 6's rate limit — per-user (not per-IP, unlike HTTP's
   * RateLimitGuard: two tabs on one connection, or a shared office IP
   * during a drop, shouldn't share one budget), Redis-backed, fails open
   * on a Redis error for the same reason RateLimitGuard does.
   */
  private async underRateLimit(userId: string): Promise<boolean> {
    const key = `chat-rate:${userId}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 60);
      return count <= RATE_LIMIT_PER_MINUTE;
    } catch {
      return true;
    }
  }

  private async send(client: WebSocket, roomId: string, body: string): Promise<void> {
    const identity = connectionIdentity.get(client);
    if (!identity) return this.sendError(client, 'Sign in to chat.');

    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return this.sendError(client, `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
    }

    if (!(await this.underRateLimit(identity.userId))) {
      return this.sendError(client, "You're sending messages too fast — slow down.");
    }

    const room = await this.rooms.getById(roomId);
    if (!room) return this.sendError(client, 'This chat room does not exist.');
    if (room.status === 'archived') return this.sendError(client, 'This chat is archived — read-only now.');
    if (room.status !== 'open') return this.sendError(client, 'This chat has not opened yet.');

    const message = await this.messages.create(roomId, identity.userId, trimmed);

    // Task 7's block enforcement, live side: one query per send (not per
    // recipient) — the set of users blocked-either-way with the author,
    // checked against each connected member's own identity below. A
    // room-mate with no identity (never signed in / expired token) has
    // no block relationship possible and always receives the message,
    // same as an anonymous feed reader seeing every post.
    const excludedRecipients = await this.blocks.blockedUserIds(identity.userId);
    await this.publishToRoom(roomId, { type: 'chat:message', roomId, message }, excludedRecipients);

    // Broadcast-then-review (task 7, approved tradeoff — see
    // ChatMessagesService's own doc comment): classification runs after
    // the message is already visible, never before.
    void this.messages.classifyAndMaybeRetract(message.id, trimmed).then((flagged) => {
      if (flagged) void this.publishToRoom(roomId, { type: 'chat:retract', roomId, messageId: message.id }, []);
    });
  }

  /**
   * Day 26: every live chat frame goes out through Redis pub/sub rather
   * than a direct `broadcastToRoom` call, so instance B's room members
   * get it too (see `onModuleInit`'s CHAT_BROADCAST_CHANNEL handler,
   * which is this same publish's delivery half — including on *this*
   * instance, there's no local-delivery shortcut). Uses the shared
   * request-path `this.redis` client (PUBLISH isn't a blocking command,
   * unlike the dedicated subscriber's SUBSCRIBE), same client
   * `underRateLimit` above already issues commands on.
   */
  private async publishToRoom(roomId: string, payload: unknown, excludedRecipients: string[]): Promise<void> {
    try {
      await this.redis.publish(CHAT_BROADCAST_CHANNEL, JSON.stringify({ roomId, payload, excludedRecipients }));
    } catch (err) {
      this.logger.error(`failed to publish chat broadcast for room ${roomId}: ${(err as Error).message}`);
    }
  }

  /**
   * Per-client try/catch (same discipline as DropLiveGateway.broadcast)
   * — one half-closed socket in a room must not stop delivery to the
   * rest. `excludedRecipients` (task 7) skips any connected member whose
   * identified userId is in that set — a blocked-either-way relationship
   * with the message's author means this specific client never receives
   * this specific broadcast, while everyone else in the room still does.
   */
  private broadcastToRoom(roomId: string, payload: unknown, excludedRecipients: string[] = []): void {
    const members = roomMembers.get(roomId);
    if (!members || members.size === 0) return;
    const excluded = new Set(excludedRecipients);
    const outgoing = JSON.stringify(payload);
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const client of members) {
      if (client.readyState !== client.OPEN) continue;
      const recipientId = connectionIdentity.get(client)?.userId;
      if (recipientId && excluded.has(recipientId)) {
        skipped++;
        continue;
      }
      try {
        client.send(outgoing);
        sent++;
      } catch (err) {
        failed++;
        this.logger.warn(`chat send failed for one client in room ${roomId}: ${(err as Error).message}`);
      }
    }
    this.logger.debug(
      `chat room ${roomId}: sent to ${sent} client(s)${skipped ? `, ${skipped} blocked` : ''}${failed ? `, ${failed} failed` : ''}`,
    );
  }
}
