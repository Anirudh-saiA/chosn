import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.provider';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { comments, posts, pollVotes, votes } from '../db/schema';
import { ReputationService } from '../reputation/reputation.service';
import { ReportsService } from '../trust-safety/reports.service';
import { CastPollVoteDto } from './dto/cast-poll-vote.dto';
import { CastVoteDto } from './dto/cast-vote.dto';

/**
 * Day 24 task 6's vote-manipulation guard — flagged for override, per
 * the brief's own request. Soft signal, not a block: the hard limit
 * that actually stops a runaway script is VotesController's existing
 * `RateLimitGuard` (120 votes/hour — see that controller's own
 * decorator), unchanged today and already real. This threshold is
 * tighter and shorter-window on purpose — 10 votes inside 2 minutes is
 * well inside that hourly budget but still an unusual burst worth a
 * human's eyes (someone rapid-toggling one item's up/down repeatedly,
 * or working through a list fast enough to look automated), auto-filed
 * into the same admin queue a human report goes through rather than
 * silently blocked, since a legitimate fast reader genuinely can vote
 * this much this quickly and shouldn't be locked out on a heuristic
 * alone. One flag per user per cooldown window, not one per over-limit
 * vote, so a single burst doesn't flood the queue with duplicates.
 */
const VOTE_ANOMALY_THRESHOLD = 10;
const VOTE_ANOMALY_WINDOW_SECONDS = 120;
const VOTE_ANOMALY_COOLDOWN_SECONDS = 3600;

@Injectable()
export class VotesService {
  private readonly logger = new Logger(VotesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reputation: ReputationService,
    private readonly reports: ReportsService,
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

    this.checkForAnomaly(userId).catch((err) => {
      this.logger.warn(`vote-anomaly check failed for ${userId}: ${(err as Error).message}`);
    });

    return { voteScore };
  }

  /**
   * Sliding-window burst detection — same ZADD/ZREMRANGEBYSCORE shape
   * as the sliding-window rate limiter (auth-rate-limit.controller.ts),
   * applied as a soft signal here instead of a hard block. Fails open
   * on any Redis error (never lets a moderation side-effect block or
   * slow the vote itself) and never throws — always called fire-and-
   * forget from `cast()`.
   */
  private async checkForAnomaly(userId: string): Promise<void> {
    const key = `vote-activity:${userId}`;
    const now = Date.now();
    const pipeline = this.redis.pipeline();
    pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);
    pipeline.zremrangebyscore(key, 0, now - VOTE_ANOMALY_WINDOW_SECONDS * 1000);
    pipeline.zcard(key);
    pipeline.expire(key, VOTE_ANOMALY_WINDOW_SECONDS);
    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;
    if (count < VOTE_ANOMALY_THRESHOLD) return;

    const cooldownKey = `vote-anomaly-cooldown:${userId}`;
    // SET ... NX: only the first caller to cross the threshold within a
    // cooldown window actually files the report — every vote after it
    // in the same burst sees the key already set and does nothing.
    const acquired = await this.redis.set(cooldownKey, '1', 'EX', VOTE_ANOMALY_COOLDOWN_SECONDS, 'NX');
    if (!acquired) return;

    await this.reports.create(null, {
      reportedEntityType: 'user',
      reportedEntityId: userId,
      reason: 'other',
      details: `Auto-flagged: ${count} votes cast within ${VOTE_ANOMALY_WINDOW_SECONDS}s — unusual voting burst, review for possible manipulation.`,
    });
    this.logger.log(`vote-anomaly report filed for user ${userId} (${count} votes/${VOTE_ANOMALY_WINDOW_SECONDS}s)`);
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
