import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { comments, posts, userReputation, users } from '../db/schema';
import { ReputationService } from '../reputation/reputation.service';
import { CommunityNotificationsService } from './community-notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';

export interface CommentSummary {
  id: string;
  postId: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarSeed: string;
  authorReputationScore: number;
  body: string;
  createdAt: string;
}

/**
 * Legit Check's community "verdict" is just a comment (task 2: "comments
 * function as the legit check verdicts") — no separate verdict table,
 * so a Legit Check post's comment thread IS its authentication history,
 * readable the same way any other post's comments are.
 */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly reputation: ReputationService,
    private readonly communityNotifications: CommunityNotificationsService,
  ) {}

  async create(postId: string, authorUserId: string, dto: CreateCommentDto): Promise<CommentSummary> {
    const [post] = await this.db.select({ id: posts.id, authorUserId: posts.authorUserId }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) throw new NotFoundException({ error: 'not_found', message: 'Post not found.' });

    const [row] = await this.db
      .insert(comments)
      .values({ postId, authorUserId, body: dto.body })
      .returning();
    const [author] = await this.db
      .select({ displayName: users.displayName, avatarSeed: users.avatarSeed })
      .from(users)
      .where(eq(users.id, authorUserId))
      .limit(1);
    const rep = await this.reputation.getForUser(authorUserId);

    // Day 24 task 2 — reply notification to the post's own author, plus
    // any @mentions in the comment body. Awaited, not fire-and-forget:
    // CommunityNotificationsService's own contract is "the row exists
    // by the time this returns" (see its doc comment), which the
    // walkthrough test and any future in-app UI both depend on. Wrapped
    // in try/catch so a notification failure still can't fail the
    // comment itself — the same "never let bookkeeping mask the real
    // result" posture as elsewhere in this codebase, just synchronous
    // instead of fire-and-forget.
    try {
      await this.notify(postId, post.authorUserId, row!.id, authorUserId, dto.body);
    } catch (err) {
      this.logger.warn(`notification dispatch failed for comment ${row!.id}: ${(err as Error).message}`);
    }

    return {
      id: row!.id,
      postId,
      authorUserId,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarSeed: author?.avatarSeed ?? '',
      authorReputationScore: rep?.score ?? 0,
      body: row!.body,
      createdAt: row!.createdAt.toISOString(),
    };
  }

  private async notify(postId: string, postAuthorId: string, commentId: string, commenterId: string, body: string): Promise<void> {
    const replyRecipient = await this.communityNotifications.notifyReply({
      postId,
      postAuthorId,
      commentId,
      commenterId,
      commentBody: body,
    });
    await this.communityNotifications.notifyMentions({
      text: body,
      actorUserId: commenterId,
      entityType: 'comment',
      entityId: commentId,
      postId,
      excludeUserIds: replyRecipient ? [postAuthorId] : [],
    });
  }

  /** Day 24 task 3 — a profile's "their comments" activity feed. Includes the parent post's title so a bare comment reads as more than a floating sentence. */
  async listByAuthor(authorUserId: string, limit = 30): Promise<(CommentSummary & { postTitle: string | null })[]> {
    const rows = await this.db
      .select({
        id: comments.id,
        postId: comments.postId,
        authorUserId: comments.authorUserId,
        authorDisplayName: users.displayName,
        authorAvatarSeed: users.avatarSeed,
        authorReputationScore: userReputation.score,
        body: comments.body,
        createdAt: comments.createdAt,
        postTitle: posts.title,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorUserId))
      .innerJoin(posts, eq(posts.id, comments.postId))
      .leftJoin(userReputation, eq(userReputation.userId, comments.authorUserId))
      .where(and(eq(comments.authorUserId, authorUserId), eq(comments.isRemoved, false), eq(posts.isRemoved, false)))
      .orderBy(desc(comments.createdAt))
      .limit(limit);

    return rows.map((r) => ({ ...r, authorReputationScore: r.authorReputationScore ?? 0, createdAt: r.createdAt.toISOString() }));
  }

  async list(postId: string): Promise<CommentSummary[]> {
    const rows = await this.db
      .select({
        id: comments.id,
        postId: comments.postId,
        authorUserId: comments.authorUserId,
        authorDisplayName: users.displayName,
        authorAvatarSeed: users.avatarSeed,
        authorReputationScore: userReputation.score,
        body: comments.body,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorUserId))
      .leftJoin(userReputation, eq(userReputation.userId, comments.authorUserId))
      .where(and(eq(comments.postId, postId), eq(comments.isRemoved, false)))
      .orderBy(asc(comments.createdAt));

    return rows.map((r) => ({ ...r, authorReputationScore: r.authorReputationScore ?? 0, createdAt: r.createdAt.toISOString() }));
  }
}
