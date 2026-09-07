import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

const logger = new Logger('PgPool');

/**
 * node-postgres defaults `max` to 10 with no explicit config — fine for
 * local dev, not sized for concurrent request traffic. Under Day 11's
 * load test, every catalog/search read takes a connection from this
 * pool, and at sustained concurrent load a 10-connection ceiling means
 * request 11 onward queues behind whichever of the first 10 finishes
 * first rather than running in parallel — exactly the shape of the p95
 * degradation the load test measured (see load-tests/run-report.md).
 *
 * connectionTimeoutMillis is set so a genuinely exhausted pool fails a
 * request fast and visibly (Sentry-visible 500) rather than hanging the
 * request indefinitely waiting for a connection that may never free up.
 */
export const pgPoolProvider = {
  provide: PG_POOL,
  useFactory: () => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // `||`, not `??` — an unset var in .env is an empty string, not
      // undefined, and Number('') is 0, which would silently create a
      // pool with no connections at all.
      max: Number(process.env.PG_POOL_MAX || 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    // Found during Day 11's monitoring check (task 8), not the load
    // test itself: node-postgres's Pool emits 'error' when an IDLE
    // client's connection drops — a database restart, a network blip,
    // Railway recycling a connection, all completely normal operational
    // events. With no listener attached, Node's default behavior for an
    // unhandled EventEmitter 'error' is to throw, which crashes the
    // *entire process*, not just the one request that was affected.
    // Reproduced locally by stopping the Postgres container mid-traffic:
    // the whole API went unreachable instantly, with no Sentry event and
    // no clean error log — a monitoring gap worse than a slow query,
    // since nothing downstream (Railway, Sentry, /health) got a chance
    // to report anything before the process was already gone. This
    // listener is what turns that crash into a logged, Sentry-visible
    // event instead — the pool itself recovers the connection on its
    // own once the database is reachable again.
    pool.on('error', (err) => {
      logger.error(`idle client error: ${err.message}`, err.stack);
      Sentry.captureException(err, { tags: { component: 'pg-pool' } });
    });

    return pool;
  },
};
