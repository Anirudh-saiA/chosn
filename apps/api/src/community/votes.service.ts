import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { comments, posts, pollVotes, votes } from '../db/schema';
import { ReputationService } from '../reputation/reputation.service';
import { CastPollVoteDto } from './dto/cast-poll-vote.dto';
import { CastVoteDto } from './dto/cast-vote.dto';

@Injectable()
export class VotesService {
  private readonly logger = new Logger(VotesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly reputation: ReputationService,
  ) {}

  /**
   * Generic upvote/downvote for posts and comments. `value: 0` clears an
   * existing vote — a caller toggling the same button they already
   * clicked shouldn't need a separate DELETE endpoint to express "un-vote."
   *
   * Day 23: every vote here changes whoever authored the voted-on
   * content's `helpfulVotesReceived`, so their reputation is
   * recalculated inline, after the vote itself commits — best-effort
   * (a recalculation failure must never fail the vote the user actually
   * came here to cast; ReputationSchedulerService's recurring pass is
   * the self-healing backstop if this one somehow doesn't land).
   */
  async cast(userId: string, dto: CastVoteDto): Promise<{ voteScore: number }> {
    if (dto.value === 0) {
      await this.db
        .delete(votes)
        .where(and(eq(votes.userId, userId), eq(votes.votableType, dto.votableType), eq(votes.votableId, dto.votableId)));
    } else {
      await this.db
        .insert(votes)
        .values({ userId, votableType: dto.votableType, votableId: dto.votableId, value: dto.value })
        .onConflictDoUpdate({
          target: [votes.userId, votes.votableType, votes.votableId],
          set: { value: dto.value },
        });
    }

    const voteScore = await this.scoreFor(dto.votableType, dto.votableId);

    const authorId = await this.authorOf(dto.votableType, dto.votableId);
    if (authorId) {
      this.reputation.recalculateForUser(authorId).catch((err) => {
        this.logger.warn(`reputation recalculation failed for ${authorId}: ${(err as Error).message}`);
      });
    }

    return { voteScore };
  }

  private async authorOf(votableType: 'post' | 'comment', votableId: string): Promise<string | null> {
    if (votableType === 'post') {
      const [row] = await this.db.select({ authorUserId: posts.authorUserId }).from(posts).where(eq(posts.id, votableId)).limit(1);
      return row?.authorUserId ?? null;
    }
    const [row] = await this.db.select({ authorUserId: comments.authorUserId }).from(comments).where(eq(comments.id, votableId)).limit(1);
    return row?.authorUserId ?? null;
  }

  private async scoreFor(votableType: 'post' | 'comment', votableId: string): Promise<number> {
    const rows = await this.db
      .select({ value: votes.value })
      .from(votes)
      .where(and(eq(votes.votableType, votableType), eq(votes.votableId, votableId)));
    return rows.reduce((sum, r) => sum + r.value, 0);
  }

  /** Cop or Drop's own vote table — see poll_votes' own schema comment for why it isn't `votes`. One choice per user per post; voting again changes the pick rather than adding a second ballot. */
  async castPoll(postId: string, userId: string, dto: CastPollVoteDto): Promise<{ cop: number; drop: number }> {
    const [post] = await this.db.select({ postType: posts.postType }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) throw new NotFoundException({ error: 'not_found', message: 'Post not found.' });
    if (post.postType !== 'cop_or_drop') {
      throw new NotFoundException({ error: 'not_a_poll', message: 'This post is not a Cop or Drop poll.' });
    }

    await this.db
      .insert(pollVotes)
      .values({ postId, userId, choice: dto.choice })
      .onConflictDoUpdate({ target: [pollVotes.postId, pollVotes.userId], set: { choice: dto.choice } });

    const rows = await this.db.select({ choice: pollVotes.choice }).from(pollVotes).where(eq(pollVotes.postId, postId));
    return {
      cop: rows.filter((r) => r.choice === 'cop').length,
      drop: rows.filter((r) => r.choice === 'drop').length,
    };
  }
}
