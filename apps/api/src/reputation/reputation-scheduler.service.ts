import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Queue, Worker } from 'bullmq';
import { bullConnection } from '../queue/queue.config';
import { ReputationService } from './reputation.service';

const REPUTATION_SCHEDULER_QUEUE = 'reputation-scheduler';

/**
 * The recurring half of the reputation freshness model (see
 * ReputationService's own doc comment): a full recalculation pass every
 * few hours, same `upsertJobScheduler` recurring-job shape as
 * DropSchedulerService and ChatRoomSchedulerService — idempotent
 * registration, so every replica booting converges on one schedule
 * rather than N.
 *
 * 6 hours by default: reputation isn't time-critical the way a live
 * drop flip is (Day 13's scheduler polls every 1–5 minutes for exactly
 * that reason) — the only thing a slow recalculation delays is
 * account-age points ticking forward for someone nobody has voted on
 * recently, and the vote-triggered recalculation in VotesService.cast
 * already keeps the vote-driven half of the score current in real time.
 * Tunable via REPUTATION_SCHEDULER_INTERVAL_HOURS; opt out entirely
 * with REPUTATION_SCHEDULER_SCHEDULE=off, same escape hatch every other
 * scheduler in this codebase offers for local runs.
 */
@Injectable()
export class ReputationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReputationSchedulerService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly reputation: ReputationService) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — reputation scheduler not started');
      return;
    }

    const connection = bullConnection();
    this.queue = new Queue(REPUTATION_SCHEDULER_QUEUE, { connection });
    this.worker = new Worker(REPUTATION_SCHEDULER_QUEUE, () => this.reputation.recalculateAll(), {
      connection,
      concurrency: 1,
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`reputation recalculation tick failed: ${err.message}`);
      Sentry.captureException(err, { tags: { component: 'reputation-scheduler' } });
    });

    if (process.env.REPUTATION_SCHEDULER_SCHEDULE !== 'off') {
      const hours = Number(process.env.REPUTATION_SCHEDULER_INTERVAL_HOURS || 6);
      await this.queue.upsertJobScheduler(
        'reputation-scheduler-recurring',
        { every: hours * 60 * 60_000 },
        { name: 'reputation-scheduler-tick' },
      );
      this.logger.log(`reputation scheduler ready, recalculating every ${hours}h`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
