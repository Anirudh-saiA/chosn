import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import type { Server, WebSocket } from 'ws';
import { bullConnection } from '../queue/queue.config';
import { DROP_LIVE_CHANNEL, isDropLiveEvent } from './drop-events.pubsub';

/**
 * WebSocket broadcast, the second consumer of `drop:live` (Day 13's
 * channel — see drop-events.pubsub.ts, unchanged by adding this).
 *
 * Room scoping — flagged for override per the brief: this broadcasts to
 * every connected client (one global room), not per-brand/per-model
 * rooms. At today's scale (a handful of launch-catalog drops, a handful
 * of concurrent viewers) targeted rooms are real complexity — client-
 * side room-join/leave bookkeeping on every page navigation — for a
 * broadcast that costs nothing extra to send globally. The payload
 * already carries dropEventId/sneakerId, so an uninterested client just
 * ignores an event that isn't about the page it's looking at; the cost
 * of going global is a few unused bytes on the wire per client, not a
 * wrong UI update. Revisit with targeted rooms once concurrent viewers
 * or drop frequency are actually high enough for that "unused bytes"
 * cost to matter — not before.
 *
 * Uses `ws`, not Socket.io: no rooms/namespaces needed for a global
 * broadcast, so the plain protocol (native browser WebSocket, no client
 * library, faster, smaller dependency surface) is a strictly better fit
 * than pulling in Socket.io's extra machinery for features this gateway
 * doesn't use. Mounted at its own `path` (ws has no namespaces).
 */
@WebSocketGateway({ path: '/ws/drops' })
export class DropLiveGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DropLiveGateway.name);
  private subscriber?: Redis;

  @WebSocketServer()
  private server!: Server;

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — drop WebSocket broadcaster not started');
      return;
    }

    // Dedicated connection, same reasoning as DropNewsAutoPostService:
    // a subscribed ioredis connection can't also issue other commands,
    // and this consumer is independent of every other one on this
    // channel — a broadcast failure here must never affect the news
    // auto-post consumer or (Day 14's other new consumer) web push.
    this.subscriber = new Redis(bullConnection());
    await this.subscriber.subscribe(DROP_LIVE_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== DROP_LIVE_CHANNEL) return;
      this.broadcast(message);
    });
    this.subscriber.on('error', (err) => {
      this.logger.error(`subscriber connection error: ${err.message}`);
    });

    this.logger.log(`subscribed to ${DROP_LIVE_CHANNEL}, broadcasting on ws path /ws/drops`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
  }

  /**
   * Broadcasts the raw event to every open connection. Per-client
   * try/catch (task 5): one client with a half-closed socket throwing
   * on `.send()` must not stop the loop and skip the rest of the
   * connected clients.
   */
  private broadcast(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`malformed ${DROP_LIVE_CHANNEL} payload, not JSON: ${raw.slice(0, 200)}`);
      return;
    }
    if (!isDropLiveEvent(parsed)) {
      this.logger.error(`malformed ${DROP_LIVE_CHANNEL} payload, missing fields: ${raw.slice(0, 200)}`);
      return;
    }

    const outgoing = JSON.stringify({ type: 'drop:live', ...parsed });
    let sent = 0;
    let failed = 0;
    for (const client of this.server.clients as Set<WebSocket>) {
      if (client.readyState !== client.OPEN) continue;
      try {
        client.send(outgoing);
        sent++;
      } catch (err) {
        failed++;
        this.logger.warn(`send failed for one client: ${(err as Error).message}`);
      }
    }
    this.logger.log(`broadcast drop:live for ${parsed.dropEventId} to ${sent} client(s)${failed ? `, ${failed} failed` : ''}`);
  }
}
