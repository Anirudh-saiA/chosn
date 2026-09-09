import type { JobsOptions } from 'bullmq';
import type { FetchTarget } from '../retailers/retailer-adapter.interface';

/**
 * One queue per retailer, named from the retailer slug.
 *
 * This is the whole point of the naming scheme: with ten sources on one
 * shared queue, a single retailer timing out at 10s a job would sit at
 * the head of the line and starve the other nine. Separate queues mean a
 * broken source degrades only itself — worth setting up now, with one
 * adapter, because retrofitting it after sources 2–10 exist means
 * migrating in-flight jobs.
 */
// Hyphen, not colon: BullMQ reserves ':' as its Redis key separator and
// rejects queue names containing one.
export const PRICE_QUEUE_PREFIX = 'price-fetch-';
export const priceQueueName = (retailerSlug: string) => `${PRICE_QUEUE_PREFIX}${retailerSlug}`;

/** One shared dead-letter queue — failures are reviewed together. */
export const DEAD_LETTER_QUEUE = 'price-fetch-dead-letter';

export interface PriceFetchJobData {
  retailerSlug: string;
  target: FetchTarget;
}

export interface DeadLetterJobData {
  retailerSlug: string;
  target: FetchTarget;
  failedReason: string;
  attemptsMade: number;
  failedAt: string;
}

/**
 * 3 attempts, exponential from 30s — so roughly 30s, 60s, 120s.
 *
 * Deliberately unhurried: affiliate feeds refresh about once a day, so a
 * price that failed to fetch is not urgent, and retrying a struggling
 * retailer aggressively is how you get rate-limited off a source you
 * depend on. Permanent errors bypass this entirely (see the processor) —
 * these delays only ever apply to timeouts, 429s and 5xx.
 */
export const PRICE_FETCH_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { count: 200 },
  // Keep failures around: they're the raw material for debugging a
  // retailer integration, and they stop arriving once it works.
  removeOnFail: { count: 1000 },
};

/**
 * Connection options for BullMQ, parsed from REDIS_URL.
 *
 * Deliberately options rather than a shared ioredis instance: BullMQ
 * issues blocking commands (BRPOPLPUSH and friends) and needs to own and
 * duplicate its own connections to do that safely. Handing it the client
 * the rate limiter already uses would let one blocked worker stall
 * unrelated request-path Redis calls.
 *
 * maxRetriesPerRequest: null is BullMQ's documented requirement — with a
 * finite retry count, a blocking command can be aborted mid-wait.
 *
 * Return type is deliberately inferred, not annotated as either
 * package's own type — this helper feeds two different constructors
 * across the codebase: BullMQ's Queue/Worker (which since v6 wants its
 * own `ConnectionOptions`, a pluggable-backend rework that gave it a
 * connection-options interface separate from ioredis's) and plain
 * `new Redis(...)` pub/sub clients elsewhere (drop-live.gateway.ts and
 * friends, which want ioredis's own `RedisOptions`). Pinning the
 * return type to either package's type broke the other's call sites —
 * found by fixing one and immediately breaking the other, not
 * guessed. The literal object below structurally satisfies both real
 * shapes; only an explicit type annotation was ever getting in the
 * way.
 */
export function bullConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6380');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
