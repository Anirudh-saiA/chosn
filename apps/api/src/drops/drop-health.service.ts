import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

/**
 * There's no consumers table to LEFT JOIN against (unlike retailers for
 * fetch health) — consumer names are just a slug written into
 * drop_consumer_failures on failure. Listed explicitly here so a
 * healthy consumer that has never failed still reports 0 rather than
 * being silently absent from the summary.
 *
 * The WebSocket gateway (Day 14) is deliberately not listed here: a
 * failed send to one already-closing socket isn't a meaningful
 * durable-tracking failure the way a lost push notification or a
 * missed auto-post is — see DropLiveGateway's own comment. It logs,
 * it just doesn't write to drop_consumer_failures.
 */
const KNOWN_CONSUMERS = ['news-feed-auto-post', 'web-push'] as const;

export interface DropSchedulerHealth {
  lastRunAt: string | null;
  minutesSinceLastRun: number | null;
  runs24h: number;
  flipped24h: number;
  lastError: string | null;
  /** No run within two full poll cycles — same "two cycles of grace" rule FetchHealthService uses. */
  stale: boolean;
}

export interface DropConsumerHealth {
  consumer: string;
  failures24h: number;
  lastFailureAt: string | null;
  lastReason: string | null;
}

/**
 * "Is the drop pipeline actually running?" — task 7's ask, same pattern
 * as FetchHealthService (Day 7): derive health from the durable Postgres
 * tables a real run/failure already writes to, rather than a second
 * counter that could drift from them.
 */
@Injectable()
export class DropHealthService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async schedulerSummary(): Promise<DropSchedulerHealth> {
    const pollMinutes = Number(process.env.DROP_SCHEDULER_INTERVAL_MINUTES || 1);

    const { rows } = await this.db.execute(sql`
      SELECT
        (SELECT run_at FROM drop_scheduler_runs ORDER BY run_at DESC LIMIT 1) AS last_run_at,
        (SELECT error FROM drop_scheduler_runs ORDER BY run_at DESC LIMIT 1) AS last_error,
        COUNT(*) FILTER (WHERE run_at > now() - INTERVAL '24 hours') AS runs_24h,
        COALESCE(SUM(flipped) FILTER (WHERE run_at > now() - INTERVAL '24 hours'), 0) AS flipped_24h
      FROM drop_scheduler_runs
    `);

    const row = rows[0] as Record<string, unknown>;
    const lastRun = row.last_run_at ? new Date(row.last_run_at as string) : null;
    const minutesSince = lastRun ? Math.floor((Date.now() - lastRun.getTime()) / 60_000) : null;

    return {
      lastRunAt: lastRun ? lastRun.toISOString() : null,
      minutesSinceLastRun: minutesSince,
      runs24h: Number(row.runs_24h),
      flipped24h: Number(row.flipped_24h),
      lastError: (row.last_error as string) ?? null,
      stale: minutesSince === null || minutesSince > pollMinutes * 2,
    };
  }

  async consumerSummary(): Promise<DropConsumerHealth[]> {
    // Deliberately not `UNNEST(${names}::text[])` — Drizzle's sql``
    // template doesn't bind a plain JS array as a single Postgres
    // array-typed parameter the way raw node-postgres does; it
    // flattens it to one bare scalar, and casting that to ::text[]
    // fails at the database with "malformed array literal" (caught
    // live, during today's manual end-to-end test — see
    // drops/README.md's verification section). sql.join builds a real
    // `ARRAY[$1, $2, ...]` literal instead, each element its own
    // properly bound parameter.
    const known = sql.join(
      KNOWN_CONSUMERS.map((name) => sql`${name}`),
      sql`, `,
    );
    const { rows } = await this.db.execute(sql`
      SELECT
        known.consumer,
        COUNT(f.id) FILTER (WHERE f.failed_at > now() - INTERVAL '24 hours') AS failures_24h,
        MAX(f.failed_at)                                                     AS last_failure_at,
        (ARRAY_AGG(f.reason ORDER BY f.failed_at DESC))[1]                   AS last_reason
      FROM UNNEST(ARRAY[${known}]::text[]) AS known(consumer)
      LEFT JOIN drop_consumer_failures f ON f.consumer = known.consumer
      GROUP BY known.consumer
      ORDER BY known.consumer
    `);

    return (rows as Record<string, unknown>[]).map((row) => ({
      consumer: String(row.consumer),
      failures24h: Number(row.failures_24h),
      lastFailureAt: row.last_failure_at ? new Date(row.last_failure_at as string).toISOString() : null,
      lastReason: (row.last_reason as string) ?? null,
    }));
  }
}
