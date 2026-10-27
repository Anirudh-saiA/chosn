import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { PG_BG_POOL, PG_POOL } from './db.provider';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';
/** Drizzle on the small background pool; only background jobs inject this. */
export const DRIZZLE_BG = 'DRIZZLE_BG';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Drizzle wraps the existing pg Pool rather than opening its own — one
 * connection pool for the process, shared with the raw-SQL paths
 * (migrations, EXPLAIN) that don't go through the ORM.
 */
export const drizzleProvider = {
  provide: DRIZZLE,
  inject: [PG_POOL],
  useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
};

export const drizzleBgProvider = {
  provide: DRIZZLE_BG,
  inject: [PG_BG_POOL],
  useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
};
