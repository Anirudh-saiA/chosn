import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { chatMessages, userReputation, users } from '../db/schema';
import { classifyText } from '../moderation/classifier.service';
import { ReputationService } from '../reputation/reputation.service';
import { BlocksService } from '../trust-safety/blocks.service';

export interface ChatMessageSummary {
  id: string;
  roomId: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarSeed: string;
  authorReputationScore: number;
  body: string;
  classifierStatus: string;
  createdAt: string;
}

/**
 * Broadcast-then-review (task 7, flagged for sign-off in the brief and
 * approved as the direction): a message is stored and handed back for
 * immediate broadcast in `create()` — the classifier never sits between
 * "hit send" and "message appears" for anyone. `classifyAndMaybeRetract`
 * runs after, called fire-and-forget from the gateway, and only matters
 * for the rare flagged case: the caller broadcasts a retraction once
 * this resolves 'flagged', same shape as a Twitch/Discord-style
 * post-hoc removal rather than a pre-send hold.
 */
@Injectable()
export class ChatMessagesService {
  private readonly logger = new Logger(ChatMessagesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly blocks: BlocksService,
    private readonly reputation: ReputationService,
  ) {}

  async create(roomId: string, authorUserId: string, body: string): Promise<ChatMessageSummary> {
    const [row] = await this.db.insert(chatMessages).values({ roomId, authorUserId, body }).returning();
    const [author] = await this.db
      .select({ displayName: users.displayName, avatarSeed: users.avatarSeed })
      .from(users)
      .where(eq(users.id, authorUserId))
      .limit(1);
    const rep = await this.reputation.getForUser(authorUserId);

    return {
      id: row!.id,
      roomId,
      authorUserId,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarSeed: author?.avatarSeed ?? '',
      authorReputationScore: rep?.score ?? 0,
      body: row!.body,
      classifierStatus: row!.classifierStatus,
      createdAt: row!.createdAt.toISOString(),
    };
  }

  /**
   * Returns true if the message was flagged (and therefore removed) —
   * the caller's signal to broadcast a retraction. A classifier failure
   * or a 'clean' verdict both resolve to false: the message just stays
   * up, same fail-open posture every other classifier call site in this
   * app takes (a moderation tool going down must never itself become an
   * outage for the feature it's watching).
   */
  async classifyAndMaybeRetract(messageId: string, body: string): Promise<boolean> {
    try {
      const verdict = await classifyText(body);
      const status = !verdict ? 'clean' : verdict.toxic ? 'flagged' : 'clean';
      await this.db.update(chatMessages).set({ classifierStatus: status }).where(eq(chatMessages.id, messageId));

      if (status === 'flagged') {
        await this.db.update(chatMessages).set({ isRemoved: true }).where(eq(chatMessages.id, messageId));
        return true;
      }
      return false;
    } catch (err) {
      this.logger.warn(`chat message classification failed for ${messageId}: ${(err as Error).message}`);
      Sentry.captureException(err, { tags: { component: 'chat-classifier' } });
      return false;
    }
  }

  /**
   * Task 7's block enforcement, read side: a signed-in viewer never sees
   * history from someone they've blocked (or who's blocked them) — same
   * `blockedUserIds` set-based approach PostsService's feed filtering
   * uses, not a per-row `isBlockedEitherWay` check. An anonymous viewer
   * (no `viewerUserId`) sees everything, same as an anonymous feed
   * reader — blocking is an account-holder's control, not something an
   * unauthenticated request can invoke either direction.
   */
  async history(roomId: string, limit = 100, viewerUserId: string | null = null): Promise<ChatMessageSummary[]> {
    const excludedAuthors = viewerUserId ? await this.blocks.blockedUserIds(viewerUserId) : [];

    const rows = await this.db
      .select({
        id: chatMessages.id,
        roomId: chatMessages.roomId,
        authorUserId: chatMessages.authorUserId,
        authorDisplayName: users.displayName,
        authorAvatarSeed: users.avatarSeed,
        authorReputationScore: userReputation.score,
        body: chatMessages.body,
        classifierStatus: chatMessages.classifierStatus,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.authorUserId))
      .leftJoin(userReputation, eq(userReputation.userId, chatMessages.authorUserId))
      .where(
        and(
          eq(chatMessages.roomId, roomId),
          eq(chatMessages.isRemoved, false),
          excludedAuthors.length > 0 ? notInArray(chatMessages.authorUserId, excludedAuthors) : undefined,
        ),
      )
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);

    return rows.map((r) => ({ ...r, authorReputationScore: r.authorReputationScore ?? 0, createdAt: r.createdAt.toISOString() }));
  }
}
