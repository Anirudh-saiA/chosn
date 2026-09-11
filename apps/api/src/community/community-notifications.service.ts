import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.provider';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { communityNotifications, users } from '../db/schema';
import { COMMUNITY_NOTIFY_CHANNEL } from './community-notifications.pubsub';
import { parseMentionTokens } from './mention-parser';

export interface CommunityNotificationSummary {
  id: string;
  type: 'reply' | 'mention';
  actorUserId: string;
  actorDisplayName: string | null;
  entityType: 'post' | 'comment';
  postId: string;
  preview: string;
  createdAt: string;
  readAt: string | null;
}

const PREVIEW_MAX_LENGTH = 160;

/**
 * Day 24 task 2. Two things happen at comment/post creation time, both
 * synchronous, in this order:
 *
 *   1. A `community_notifications` row is written directly (durable,
 *      immediately queryable — the in-app notification list this
 *      creates never depends on Redis or a consumer being up).
 *   2. One event per notification is published on
 *      `community:notify` (see that file's own comment) purely to
 *      trigger a *push* send — `CommunityPushConsumer` is the only
 *      thing that ever reads that channel, and it does no DB writes of
 *      its own.
 *
 * This is the same division DropSchedulerService/DropPushConsumer use
 * (durable write here, pub/sub for the real-time/external-delivery
 * concern there), not a new pattern — see this class's own call sites
 * in PostsService/CommentsService for where it's wired in.
 */
@Injectable()
export class CommunityNotificationsService {
  private readonly logger = new Logger(CommunityNotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** A new comment: notify the post's author (task 2's "reply to your post"). Comments are flat (no parent_comment_id — see comments' own schema comment), so "reply to your comment" isn't a distinguishable event from "a new comment on your post" today; this covers the post-author case, which is what a flat thread actually supports. Mentions inside the comment body are handled separately by `notifyMentions`. */
  async notifyReply(params: {
    postId: string;
    postAuthorId: string;
    commentId: string;
    commenterId: string;
    commentBody: string;
  }): Promise<string | null> {
    if (params.postAuthorId === params.commenterId) return null; // no self-notification
    return this.create({
      recipientUserId: params.postAuthorId,
      actorUserId: params.commenterId,
      type: 'reply',
      entityType: 'comment',
      entityId: params.commentId,
      postId: params.postId,
      preview: params.commentBody,
    });
  }

  /**
   * Parses `@token` mentions out of a post/comment body and notifies
   * each resolvable, distinct user — see mention-parser.ts's own doc
   * comment for the matching rule and its real limitations.
   * `excludeUserIds` keeps this from double-notifying someone who
   * already got a `reply` notification for the same event (mentioning
   * the post's own author in your reply to them shouldn't produce two
   * separate notifications), and never notifies the author of the text
   * itself even if they typed their own token.
   */
  async notifyMentions(params: {
    text: string;
    actorUserId: string;
    entityType: 'post' | 'comment';
    entityId: string;
    postId: string;
    excludeUserIds?: string[];
  }): Promise<string[]> {
    const tokens = parseMentionTokens(params.text);
    if (tokens.length === 0) return [];

    const excluded = new Set([params.actorUserId, ...(params.excludeUserIds ?? [])]);
    // inArray, not a raw `= ANY(${tokens})` — found the hard way: Drizzle's
    // `sql` tag spreads an interpolated JS array into `($1, $2, ...)`
    // (correct for `IN`, exactly what inArray produces), not a real
    // Postgres array literal, so `= ANY($1)` fails at the DB with
    // "op ANY/ALL (array) requires array on right side" — confirmed by
    // running the two forms directly against Postgres, not assumed.
    const matches = await this.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(sql`lower(${users.displayName})`, tokens));

    const created: string[] = [];
    for (const match of matches) {
      if (excluded.has(match.id)) continue;
      const id = await this.create({
        recipientUserId: match.id,
        actorUserId: params.actorUserId,
        type: 'mention',
        entityType: params.entityType,
        entityId: params.entityId,
        postId: params.postId,
        preview: params.text,
      });
      if (id) created.push(id);
    }
    return created;
  }

  private async create(params: {
    recipientUserId: string;
    actorUserId: string;
    type: 'reply' | 'mention';
    entityType: 'post' | 'comment';
    entityId: string;
    postId: string;
    preview: string;
  }): Promise<string | null> {
    const [recipient] = await this.db
      .select({ notifyOnCommunityActivity: users.notifyOnCommunityActivity })
      .from(users)
      .where(eq(users.id, params.recipientUserId))
      .limit(1);
    // Opted out means opted out of the notification existing at all,
    // not just the push — see schema.ts's own comment on this column.
    if (!recipient?.notifyOnCommunityActivity) return null;

    const [row] = await this.db
      .insert(communityNotifications)
      .values({
        recipientUserId: params.recipientUserId,
        actorUserId: params.actorUserId,
        type: params.type,
        entityType: params.entityType,
        entityId: params.entityId,
        postId: params.postId,
        preview: params.preview.slice(0, PREVIEW_MAX_LENGTH),
      })
      .returning({ id: communityNotifications.id });

    if (!row) return null;

    // Best-effort: a failed publish only costs this one person a push
    // notification — the durable row above already exists regardless,
    // so their in-app notification list is correct either way.
    this.redis
      .publish(COMMUNITY_NOTIFY_CHANNEL, JSON.stringify({ notificationId: row.id, recipientUserId: params.recipientUserId, type: params.type }))
      .catch((err) => this.logger.warn(`publish failed for notification ${row.id}: ${(err as Error).message}`));

    return row.id;
  }

  async listForUser(userId: string, limit = 30): Promise<CommunityNotificationSummary[]> {
    const rows = await this.db
      .select({
        id: communityNotifications.id,
        type: communityNotifications.type,
        actorUserId: communityNotifications.actorUserId,
        actorDisplayName: users.displayName,
        entityType: communityNotifications.entityType,
        postId: communityNotifications.postId,
        preview: communityNotifications.preview,
        createdAt: communityNotifications.createdAt,
        readAt: communityNotifications.readAt,
      })
      .from(communityNotifications)
      .innerJoin(users, eq(users.id, communityNotifications.actorUserId))
      .where(eq(communityNotifications.recipientUserId, userId))
      .orderBy(desc(communityNotifications.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt ? r.readAt.toISOString() : null,
    }));
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityNotifications)
      .where(and(eq(communityNotifications.recipientUserId, userId), isNull(communityNotifications.readAt)));
    return row?.count ?? 0;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db
      .update(communityNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(communityNotifications.recipientUserId, userId), isNull(communityNotifications.readAt)));
  }

  async getPreference(userId: string): Promise<boolean> {
    const [row] = await this.db.select({ v: users.notifyOnCommunityActivity }).from(users).where(eq(users.id, userId)).limit(1);
    return row?.v ?? true;
  }

  async setPreference(userId: string, enabled: boolean): Promise<void> {
    await this.db.update(users).set({ notifyOnCommunityActivity: enabled }).where(eq(users.id, userId));
  }

  /** For the push consumer — recipient ids resolved elsewhere via `subscribers`/`webPushSubscriptions`, this just reads back what got written so the push payload has real content. */
  async getById(notificationId: string): Promise<CommunityNotificationSummary | null> {
    const rows = await this.db
      .select({
        id: communityNotifications.id,
        type: communityNotifications.type,
        actorUserId: communityNotifications.actorUserId,
        actorDisplayName: users.displayName,
        entityType: communityNotifications.entityType,
        postId: communityNotifications.postId,
        preview: communityNotifications.preview,
        createdAt: communityNotifications.createdAt,
        readAt: communityNotifications.readAt,
      })
      .from(communityNotifications)
      .innerJoin(users, eq(users.id, communityNotifications.actorUserId))
      .where(eq(communityNotifications.id, notificationId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt ? row.readAt.toISOString() : null };
  }
}
