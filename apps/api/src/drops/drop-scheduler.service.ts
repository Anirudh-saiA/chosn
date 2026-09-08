import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Queue, Worker } from 'bullmq';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { dropSchedulerRuns } from '../db/schema';
import { bullConnection } from '../queue/queue.config';
import { DROP_LIVE_CHANNEL, type DropLiveEvent } from './drop-events.pubsub';

/** Hyphen, not colon — same BullMQ queue-name rule as queue.config.ts. */
const DROP_SCHEDULER_QUEUE = 'drop-scheduler';

interface FlippedRow {
  dropEventId: string;
  sneakerId: string;
}

/**
 * The "instant" mechanism's trigger half (Day 12's spec): a BullMQ
 * recurring job that polls drop_events for anything due, flips it live,
 * and publishes one Redis Pub/Sub event per flip. Everything downstream
 * (news auto-post today, WebSocket/push on Day 14) is a separate
 * consumer of that one channel — this service knows nothing about them,
 * on purpose, matching the decoupling the design doc called out as the
 * actual point of the pub/sub split.
 *
 * Polls every 1–5 minutes per the brief (default 1 — "instant" is the
 * whole point, and this query is a single indexed UPDATE against a
 * table that stays small, so tight polling costs nothing worth trading
 * away for a slower cadence). Tunable via DROP_SCHEDULER_INTERVAL_MINUTES.
 */
@Injectable()
export class DropSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DropSchedulerService.name);
  private queue?: Queue;
  private worker?: Worker;
  private publisher?: Redis;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — drop scheduler not started');
      return;
    }

    const connection = bullConnection();
    // A dedicated connection for publishing, not the shared request-path
    // REDIS_CLIENT (tuned with maxRetriesPerRequest: 1 to fail open for
    // rate limiting — a different tradeoff than we want here) and not
    // reused from BullMQ's own internal connection, which it manages
    // itself. Same "each concern owns its connection" precedent
    // queue.config.ts already established for BullMQ vs. REDIS_CLIENT.
    this.publisher = new Redis(connection);

    this.queue = new Queue(DROP_SCHEDULER_QUEUE, { connection });
    this.worker = new Worker(DROP_SCHEDULER_QUEUE, () => this.tick(), {
      connection,
      concurrency: 1,
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`drop scheduler tick failed: ${err.message}`);
      Sentry.captureException(err, { tags: { component: 'drop-scheduler' } });
    });

    // Opt out with DROP_SCHEDULER_SCHEDULE=off for local runs where you
    // don't want the background poll firing — same escape hatch
    // PriceFetchService already offers via PRICE_FETCH_SCHEDULE.
    if (process.env.DROP_SCHEDULER_SCHEDULE !== 'off') {
      const minutes = Number(process.env.DROP_SCHEDULER_INTERVAL_MINUTES || 1);
      // upsertJobScheduler is idempotent (upsert), so every replica
      // registering it on boot converges on one recurring schedule
      // rather than N — same as PriceFetchService's recurring jobs.
      await this.queue.upsertJobScheduler(
        'drop-scheduler-recurring',
        { every: minutes * 60_000 },
        { name: 'drop-scheduler-tick' },
      );
      this.logger.log(`drop scheduler ready, polling every ${minutes}m`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.publisher?.quit();
  }

  /**
   * One poll cycle: flip whatever's due, publish one event per flip,
   * record the run. Public (not private) so the manual end-to-end test
   * script can invoke it directly rather than waiting on BullMQ's timer
   * — the brief's task 6 wants the *scheduler* left to run naturally,
   * which this still does in the running API process; the test script
   * only uses this method to poll status without faking the trigger.
   */
  async tick(): Promise<{ flipped: number }> {
    const startedAt = Date.now();
    const { rows, error } = await this.flipDueDrops();

    for (const row of rows) {
      await this.publish(row);
    }

    await this.recordRun(rows.length, Date.now() - startedAt, error);
    return { flipped: rows.length };
  }

  /**
   * The idempotency guard the brief asks for explicitly: only rows still
   * in 'upcoming' are touched, and the UPDATE + RETURNING happen as one
   * atomic statement. If this tick somehow overlapped another run of
   * itself (it can't today — concurrency: 1 and one recurring job — but
   * this makes it true regardless of that), Postgres's row-level locking
   * means the second UPDATE simply matches zero rows for whatever the
   * first one already flipped, rather than both seeing the same
   * 'upcoming' row and both trying to publish for it.
   *
   * release_time IS NOT NULL is deliberate: a drop with a TBA hour
   * (Day 12's schema note) has nothing to compare against `now()` and
   * must go live through the manual/webhook path the design doc
   * describes, never by this automatic poll guessing a time.
   */
  private async flipDueDrops(): Promise<{ rows: FlippedRow[]; error: string | null }> {
    try {
      const result = await this.db.execute(sql`
        UPDATE drop_events
        SET status = 'live', updated_at = now()
        WHERE status = 'upcoming'
          AND release_time IS NOT NULL
          AND (release_date + release_time) AT TIME ZONE release_timezone <= now()
        RETURNING id AS drop_event_id, sneaker_id
      `);
      const rows = (result.rows as Record<string, unknown>[]).map((r) => ({
        dropEventId: String(r.drop_event_id),
        sneakerId: String(r.sneaker_id),
      }));
      return { rows, error: null };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`drop scheduler query failed: ${message}`);
      Sentry.captureException(err, { tags: { component: 'drop-scheduler' } });
      return { rows: [], error: message };
    }
  }

  /**
   * One failed publish must not stop the loop or crash the tick (task
   * 5) — the row is already 'live' in Postgres, which stays the source
   * of truth, so a lost publish only means whichever consumers depend
   * solely on this event miss this one drop. Logged and Sentried so
   * that's visible rather than silent, same resilience shape as
   * PriceFetchService.onFailed.
   */
  private async publish(row: FlippedRow): Promise<void> {
    const event: DropLiveEvent = {
      dropEventId: row.dropEventId,
      sneakerId: row.sneakerId,
      timestamp: new Date().toISOString(),
    };
    try {
      await this.publisher!.publish(DROP_LIVE_CHANNEL, JSON.stringify(event));
      this.logger.log(`published ${DROP_LIVE_CHANNEL} for drop ${row.dropEventId}`);
    } catch (err) {
      this.logger.error(`publish failed for drop ${row.dropEventId}: ${(err as Error).message}`);
      Sentry.captureException(err, {
        tags: { component: 'drop-scheduler-publish' },
        extra: { dropEventId: row.dropEventId },
      });
    }
  }

  /** Durable run history for the health endpoint (task 7) — never lets a bookkeeping failure mask the real result. */
  private async recordRun(flipped: number, durationMs: number, error: string | null): Promise<void> {
    try {
      await this.db.insert(dropSchedulerRuns).values({ flipped, durationMs, error });
    } catch (writeErr) {
      this.logger.warn(`could not record scheduler run: ${(writeErr as Error).message}`);
    }
  }
}
