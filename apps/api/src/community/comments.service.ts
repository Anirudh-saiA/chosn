import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { comments, posts, userReputation, users } from '../db/schema';
import { ReputationService } from '../reputation/reputation.service';
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
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly reputation: ReputationService,
  ) {}

  async create(postId: string, authorUserId: string, dto: CreateCommentDto): Promise<CommentSummary> {
    const [post] = await this.db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
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
