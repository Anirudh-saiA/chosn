import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { userReputation, users } from '../db/schema';

export interface ReputationSummary {
  userId: string;
  score: number;
  accountAgePoints: number;
  helpfulVotePoints: number;
  verifiedPurchasePoints: number;
  helpfulVotesReceived: number;
  verifiedPurchaseCount: number;
  accountCreatedAt: string;
  lastCalculatedAt: string;
}

/**
 * Day 23, task 1 — v1 is deliberately transparent (a sum of named
 * points, not a black box), and the weights below are flagged for
 * override, not a considered final answer:
 *
 *   accountAgePoints       = min(daysSinceSignup, ACCOUNT_AGE_CAP_DAYS) * 1
 *   helpfulVotePoints      = helpfulVotesReceived * HELPFUL_VOTE_WEIGHT
 *   verifiedPurchasePoints = verifiedPurchaseCount * VERIFIED_PURCHASE_WEIGHT
 *   score = sum of the three
 *
 * `helpfulVotesReceived` is the sum of max(0, netVotes) across every
 * post/comment this user authored — a piece of content that nets
 * negative contributes 0, not a penalty; v1 rewards good contributions
 * rather than punishing experimentation. This, plus account age, is
 * the real v1 signal per the brief ("if you don't have real purchase-
 * verification data yet... use account activity + vote quality
 * instead") — CHOSN has no purchase/checkout flow (it's price
 * intelligence, never a marketplace, see the product's own framing),
 * so `verifiedPurchaseCount` has no real data source today and stays 0
 * for every user. The column and its weight exist so a future signal
 * (a manually-verified Legit Check, a "View Deal" click-through later
 * confirmed) is a body-only change to whatever sets that column, not a
 * schema migration or a formula rewrite.
 */
export const ACCOUNT_AGE_POINTS_PER_DAY = 1;
export const ACCOUNT_AGE_CAP_DAYS = 60;
export const HELPFUL_VOTE_WEIGHT = 3;
export const VERIFIED_PURCHASE_WEIGHT = 25;

/**
 * Task 2's gate: posting a Legit Check verdict (a claim other people
 * rely on to decide "is this pair real") requires this much reputation.
 * Deliberately reachable fast and multiple ways — ~3 days of account
 * age alone, or a single net-positively-voted comment/post, whichever
 * comes first — so it blocks a same-session mass-signup spam account,
 * not a genuine new user who just found the site. Flagged for override:
 * too high discourages new users from ever contributing a Legit Check,
 * too low (e.g. 0) makes the gate meaningless. No other action is
 * gated in v1 — chat access during high-traffic drop windows was
 * considered and deliberately left out: restricting exactly the
 * highest-excitement, highest-new-signup moment felt more likely to
 * alienate genuine new users than to meaningfully slow spam, and
 * Day 22's per-user rate limit + broadcast-then-review classifier
 * already cover the actual abuse case (message flooding, bad content)
 * without an account-standing gate. Revisit if real abuse patterns
 * during a live drop say otherwise.
 */
export const LEGIT_CHECK_MIN_REPUTATION = 3;

/**
 * One shared SQL shape (`REPUTATION_SELECT`) computing helpfulVotesReceived
 * and score fresh from posts/comments/votes — used both by the recurring
 * full-recalculation job and the single-user path a vote triggers, so the
 * two never drift into different formulas. Freshness model: score is a
 * stored, read-fast column, kept current by (a) a recalculation
 * triggered on every vote against the affected author's content, and
 * (b) ReputationSchedulerService's recurring full pass, which is what
 * keeps age-only points moving forward for a user nobody has voted on
 * recently. A badge is never computed live on render.
 */
@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async recalculateForUser(userId: string): Promise<ReputationSummary | null> {
    const [user] = await this.db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;

    const [existing] = await this.db
      .select({ verifiedPurchaseCount: userReputation.verifiedPurchaseCount })
      .from(userReputation)
      .where(eq(userReputation.userId, userId))
      .limit(1);
    const verifiedPurchaseCount = existing?.verifiedPurchaseCount ?? 0;

    const helpful = await this.helpfulVotesFor(userId);
    const accountAgeDays = Math.min(
      Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000),
      ACCOUNT_AGE_CAP_DAYS,
    );
    const accountAgePoints = accountAgeDays * ACCOUNT_AGE_POINTS_PER_DAY;
    const helpfulVotePoints = helpful * HELPFUL_VOTE_WEIGHT;
    const verifiedPurchasePoints = verifiedPurchaseCount * VERIFIED_PURCHASE_WEIGHT;
    const score = accountAgePoints + helpfulVotePoints + verifiedPurchasePoints;

    await this.db
      .insert(userReputation)
      .values({
        userId,
        score,
        helpfulVotesReceived: helpful,
        verifiedPurchaseCount,
        accountCreatedAt: user.createdAt,
      })
      .onConflictDoUpdate({
        target: userReputation.userId,
        set: { score, helpfulVotesReceived: helpful, accountCreatedAt: user.createdAt, lastCalculatedAt: new Date() },
      });

    return {
      userId,
      score,
      accountAgePoints,
      helpfulVotePoints,
      verifiedPurchasePoints,
      helpfulVotesReceived: helpful,
      verifiedPurchaseCount,
      accountCreatedAt: user.createdAt.toISOString(),
      lastCalculatedAt: new Date().toISOString(),
    };
  }

  /** Sum of max(0, netVotes) across every post and comment this user authored — one item's bad reception doesn't go negative, it just contributes nothing. */
  private async helpfulVotesFor(userId: string): Promise<number> {
    const result = await this.db.execute(sql`
      SELECT COALESCE(SUM(GREATEST(net, 0)), 0)::int AS helpful
      FROM (
        SELECT COALESCE(SUM(v.value), 0) AS net
        FROM posts p LEFT JOIN votes v ON v.votable_type = 'post' AND v.votable_id = p.id
        WHERE p.author_user_id = ${userId}
        GROUP BY p.id
        UNION ALL
        SELECT COALESCE(SUM(v.value), 0) AS net
        FROM comments c LEFT JOIN votes v ON v.votable_type = 'comment' AND v.votable_id = c.id
        WHERE c.author_user_id = ${userId}
        GROUP BY c.id
      ) t
    `);
    return Number((result.rows[0] as { helpful: number } | undefined)?.helpful ?? 0);
  }

  /**
   * The scheduler's one query: recomputes every user's score in a single
   * set-based statement rather than looping per user in JS. Same
   * formula as `recalculateForUser` (the score expression is written
   * out identically) — this is what keeps age-only points moving
   * forward for a user nobody has voted on recently, since nothing else
   * would otherwise trigger a recalculation for them.
   */
  async recalculateAll(): Promise<{ updated: number }> {
    const result = await this.db.execute(sql`
      WITH helpful AS (
        SELECT author_user_id AS user_id, COALESCE(SUM(GREATEST(net, 0)), 0)::int AS helpful_votes
        FROM (
          SELECT p.author_user_id, p.id, COALESCE(SUM(v.value), 0) AS net
          FROM posts p LEFT JOIN votes v ON v.votable_type = 'post' AND v.votable_id = p.id
          GROUP BY p.author_user_id, p.id
          UNION ALL
          SELECT c.author_user_id, c.id, COALESCE(SUM(v.value), 0) AS net
          FROM comments c LEFT JOIN votes v ON v.votable_type = 'comment' AND v.votable_id = c.id
          GROUP BY c.author_user_id, c.id
        ) per_item
        GROUP BY author_user_id
      )
      INSERT INTO user_reputation (user_id, score, helpful_votes_received, verified_purchase_count, account_created_at, last_calculated_at)
      SELECT
        u.id,
        LEAST(EXTRACT(DAY FROM now() - u.created_at)::int, ${ACCOUNT_AGE_CAP_DAYS}) * ${ACCOUNT_AGE_POINTS_PER_DAY}
          + COALESCE(h.helpful_votes, 0) * ${HELPFUL_VOTE_WEIGHT}
          + COALESCE(ur.verified_purchase_count, 0) * ${VERIFIED_PURCHASE_WEIGHT},
        COALESCE(h.helpful_votes, 0),
        COALESCE(ur.verified_purchase_count, 0),
        u.created_at,
        now()
      FROM users u
      LEFT JOIN helpful h ON h.user_id = u.id
      LEFT JOIN user_reputation ur ON ur.user_id = u.id
      ON CONFLICT (user_id) DO UPDATE SET
        score = EXCLUDED.score,
        helpful_votes_received = EXCLUDED.helpful_votes_received,
        account_created_at = EXCLUDED.account_created_at,
        last_calculated_at = EXCLUDED.last_calculated_at
      RETURNING user_id
    `);
    const updated = result.rows.length;
    this.logger.log(`recalculated reputation for ${updated} user(s)`);
    return { updated };
  }

  async getForUser(userId: string): Promise<ReputationSummary | null> {
    const [row] = await this.db.select().from(userReputation).where(eq(userReputation.userId, userId)).limit(1);
    // Lazy self-heal: a user with no row yet (created between recalculation
    // passes, or before this feature existed) gets computed on first read
    // rather than showing a false zero.
    if (!row) return this.recalculateForUser(userId);

    const accountAgeDays = Math.min(
      Math.floor((Date.now() - row.accountCreatedAt.getTime()) / 86_400_000),
      ACCOUNT_AGE_CAP_DAYS,
    );
    return {
      userId: row.userId,
      score: row.score,
      accountAgePoints: accountAgeDays * ACCOUNT_AGE_POINTS_PER_DAY,
      helpfulVotePoints: row.helpfulVotesReceived * HELPFUL_VOTE_WEIGHT,
      verifiedPurchasePoints: row.verifiedPurchaseCount * VERIFIED_PURCHASE_WEIGHT,
      helpfulVotesReceived: row.helpfulVotesReceived,
      verifiedPurchaseCount: row.verifiedPurchaseCount,
      accountCreatedAt: row.accountCreatedAt.toISOString(),
      lastCalculatedAt: row.lastCalculatedAt.toISOString(),
    };
  }

  /** Batch score lookup (userId -> score only) — what a feed/comment-thread/chat-history render needs next to every username, without an N+1 per author. Missing rows (not yet calculated) read as 0 rather than triggering N lazy recalculations mid-render. */
  async getScoresBatch(userIds: string[]): Promise<Record<string, number>> {
    if (userIds.length === 0) return {};
    const unique = [...new Set(userIds)];
    const rows = await this.db
      .select({ userId: userReputation.userId, score: userReputation.score })
      .from(userReputation)
      .where(inArray(userReputation.userId, unique));
    const byUser: Record<string, number> = {};
    for (const id of unique) byUser[id] = 0;
    for (const r of rows) byUser[r.userId] = r.score;
    return byUser;
  }
}
