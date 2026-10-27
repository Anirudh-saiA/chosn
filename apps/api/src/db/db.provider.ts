import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';
/** A second, small pool for background jobs (the hourly market-intelligence refresh), so a long job can never take connections from page requests. */
export const PG_BG_POOL = 'PG_BG_POOL';

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
      // How long a request may wait for a free connection before it fails. 5 s turned a burst (150 parallel cold pages on a small
      // database) into 500s although every query was fast once it ran; 15 s lets the burst queue. Raise or lower with PG_CONNECT_TIMEOUT_MS.
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15_000),
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

/**
 * The background pool: a few connections (BG_PG_POOL_MAX, default 3: one for the refresh transaction, one for the view refresh, one spare),
 * separate from the request pool above. pg opens connections lazily, so a process that never runs a job holds none.
 */
export const pgBgPoolProvider = {
  provide: PG_BG_POOL,
  useFactory: () => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.BG_PG_POOL_MAX || 3),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15_000),
    });
    pool.on('error', (err) => {
      logger.error(`background pool idle client error: ${err.message}`, err.stack);
      Sentry.captureException(err, { tags: { component: 'pg-bg-pool' } });
    });
    return pool;
  },
};
