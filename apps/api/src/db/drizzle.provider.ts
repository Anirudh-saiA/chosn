import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { PG_POOL } from './db.provider';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';

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
