import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { retailerProductMappings, retailers, sneakerVariants, sneakers } from '../db/schema';
import { PriceSnapshotService } from '../pricing/price-snapshot.service';
import { FlipkartAdapter } from '../retailers/flipkart/flipkart.adapter';
import {
  PermanentFetchError,
  type FetchTarget,
  type RetailerAdapter,
} from '../retailers/retailer-adapter.interface';
import {
  bullConnection,
  DEAD_LETTER_QUEUE,
  PRICE_FETCH_JOB_OPTIONS,
  priceQueueName,
  PRICE_QUEUE_PREFIX,
  type DeadLetterJobData,
  type PriceFetchJobData,
} from './queue.config';

@Injectable()
export class PriceFetchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceFetchService.name);
  private readonly queues = new Map<string, Queue<PriceFetchJobData>>();
  private readonly workers: Worker[] = [];
  private deadLetter?: Queue<DeadLetterJobData>;
  private readonly adapters = new Map<string, RetailerAdapter>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly snapshots: PriceSnapshotService,
    flipkart: FlipkartAdapter,
  ) {
    // Adapters 2–10 join this map and nothing else changes — the queue,
    // worker, retry and dead-letter wiring below is all slug-driven.
    this.adapters.set(flipkart.slug, flipkart);
  }

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — price fetch queues not started');
      return;
    }

    const connection = bullConnection();

    this.deadLetter = new Queue<DeadLetterJobData>(DEAD_LETTER_QUEUE, { connection });

    const active = await this.db
      .select({ slug: retailers.slug, name: retailers.name })
      .from(retailers);

    for (const retailer of active) {
      const adapter = this.adapters.get(retailer.slug);
      if (!adapter) continue; // no adapter built yet — Days 7+

      const name = priceQueueName(retailer.slug);
      this.queues.set(retailer.slug, new Queue<PriceFetchJobData>(name, { connection }));

      const worker = new Worker<PriceFetchJobData>(name, (job) => this.process(job), {
        connection,
        // One at a time per retailer: politeness to the source, and it
        // keeps a retailer's failures from arriving in a thundering herd.
        concurrency: 1,
      });

      worker.on('failed', (job, err) => this.onFailed(job, err));
      this.workers.push(worker);

      this.logger.log(
        `queue ${name} ready (adapter ${adapter.isConfigured ? 'live' : 'fixture mode'})`,
      );

      // Registering the repeat schedule is idempotent (upsert), so every
      // replica doing it on boot converges on one scheduler rather than N.
      // Opt out with PRICE_FETCH_SCHEDULE=off when running the API locally
      // and you do not want background fetches firing.
      if (process.env.PRICE_FETCH_SCHEDULE !== 'off') {
        await this.scheduleRecurring(retailer.slug);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.deadLetter?.close();
  }

  /**
   * Builds one job per mapped variant for a retailer and enqueues them.
   * Returns how many were queued so a manual trigger can report it.
   */
  async enqueueAll(retailerSlug: string): Promise<number> {
    const queue = this.queues.get(retailerSlug);
    if (!queue) throw new Error(`No queue for retailer "${retailerSlug}"`);

    const targets = await this.targetsFor(retailerSlug);
    await queue.addBulk(
      targets.map((target) => ({
        name: 'fetch-price',
        data: { retailerSlug, target },
        opts: {
          ...PRICE_FETCH_JOB_OPTIONS,
          // Deduplicates re-triggers of the same variant within a cycle.
          jobId: `${retailerSlug}:${target.sneakerVariantId}:${Math.floor(Date.now() / 60_000)}`,
        },
      })),
    );

    this.logger.log(`enqueued ${targets.length} jobs on ${priceQueueName(retailerSlug)}`);
    return targets.length;
  }

  /**
   * Registers the recurring schedule, driven by the retailer's own
   * fetch_frequency_minutes column rather than a constant — that column
   * exists precisely to operationalize Day 1 §01's cadence table
   * (12–24h retail, 1–4h resale), and hard-coding one interval here
   * would mean re-deciding it per adapter later.
   */
  async scheduleRecurring(retailerSlug: string): Promise<void> {
    const queue = this.queues.get(retailerSlug);
    if (!queue) return;

    const [retailer] = await this.db
      .select({ minutes: retailers.fetchFrequencyMinutes })
      .from(retailers)
      .where(eq(retailers.slug, retailerSlug))
      .limit(1);
    if (!retailer) return;

    await queue.upsertJobScheduler(
      `${retailerSlug}-recurring`,
      { every: retailer.minutes * 60_000 },
      { name: 'fetch-price-cycle', opts: PRICE_FETCH_JOB_OPTIONS },
    );
    this.logger.log(`scheduled ${retailerSlug} every ${retailer.minutes}m`);
  }

  /** Every mapped, fetchable (variant, retailer) pair. */
  private async targetsFor(retailerSlug: string): Promise<FetchTarget[]> {
    const rows = await this.db
      .select({
        styleCode: sneakers.styleCode,
        size: sneakerVariants.size,
        sizeSystem: sneakerVariants.sizeSystem,
        sneakerVariantId: sneakerVariants.id,
        retailerId: retailers.id,
        retailerProductId: retailerProductMappings.retailerProductId,
        retailerProductUrl: retailerProductMappings.retailerProductUrl,
      })
      .from(retailerProductMappings)
      .innerJoin(retailers, eq(retailers.id, retailerProductMappings.retailerId))
      .innerJoin(sneakers, eq(sneakers.id, retailerProductMappings.sneakerId))
      .innerJoin(sneakerVariants, eq(sneakerVariants.sneakerId, sneakers.id))
      .where(
        and(
          eq(retailers.slug, retailerSlug),
          isNotNull(retailerProductMappings.retailerProductId),
        ),
      );

    return rows.map((r) => ({
      styleCode: r.styleCode,
      size: Number(r.size),
      sizeSystem: r.sizeSystem,
      retailerProductId: r.retailerProductId,
      retailerProductUrl: r.retailerProductUrl,
      sneakerVariantId: r.sneakerVariantId,
      retailerId: r.retailerId,
    }));
  }

  /**
   * A cycle job fans out into per-variant jobs; a per-variant job fetches
   * and records one snapshot.
   */
  private async process(job: Job<PriceFetchJobData>): Promise<unknown> {
    if (job.name === 'fetch-price-cycle') {
      const queued = await this.enqueueAll(job.data?.retailerSlug ?? this.soleRetailer(job));
      return { queued };
    }

    const { retailerSlug, target } = job.data;
    const adapter = this.adapters.get(retailerSlug);
    if (!adapter) throw new UnrecoverableError(`No adapter for "${retailerSlug}"`);

    try {
      const offer = await adapter.fetchPrice(target);
      const input = adapter.normalize(offer, target);
      const { id } = await this.snapshots.record(input);
      return { snapshotId: id, price: input.price, inStock: input.inStock };
    } catch (err) {
      // A permanent error means retrying is pointless — UnrecoverableError
      // tells BullMQ to stop immediately and hand it to `failed`, instead
      // of burning two more attempts on a mapping that will still be
      // broken four minutes from now.
      if (err instanceof PermanentFetchError) {
        this.logger.error(
          `permanent failure ${retailerSlug} ${target.styleCode} size=${target.size}: ${err.message} ${JSON.stringify(err.context)}`,
        );
        throw new UnrecoverableError(err.message);
      }

      // Transient: log with enough context to debug and let BullMQ back off.
      this.logger.warn(
        `transient failure ${retailerSlug} ${target.styleCode} size=${target.size} attempt=${job.attemptsMade + 1}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private soleRetailer(job: Job): string {
    return job.queueName.replace(PRICE_QUEUE_PREFIX, '');
  }

  /**
   * Terminal failure — retries are spent, or the error was unrecoverable.
   * The job goes to the dead-letter queue and raises a Sentry event, so
   * a silently-broken retailer surfaces as an alert rather than as a
   * price that quietly stops updating.
   */
  private async onFailed(job: Job<PriceFetchJobData> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const unrecoverable = err.name === 'UnrecoverableError';
    if (!exhausted && !unrecoverable) return; // more attempts pending

    const payload: DeadLetterJobData = {
      retailerSlug: job.data?.retailerSlug ?? this.soleRetailer(job),
      target: job.data?.target,
      failedReason: err.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    };

    await this.deadLetter?.add('dead-letter', payload, { removeOnComplete: false });

    Sentry.captureException(err, {
      tags: { retailer: payload.retailerSlug, queue: job.queueName },
      extra: { ...payload },
    });

    this.logger.error(
      `dead-lettered ${payload.retailerSlug} ${payload.target?.styleCode ?? '?'} after ${job.attemptsMade} attempt(s): ${err.message}`,
    );
  }
}
