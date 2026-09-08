import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * apps/web's own direct Postgres connection — new as of Day 16, and
 * deliberately scoped to exactly the four Auth.js tables. Every other
 * table in this database, apps/web still only ever reads through
 * apps/api's REST endpoints (unchanged today) — auth is the one
 * exception, because @auth/drizzle-adapter's contract is "hand it a
 * Drizzle instance," and NextAuth's own request lifecycle (Next.js API
 * routes / Server Actions) runs inside apps/web's process, not
 * apps/api's. Proxying every adapter call through a second HTTP hop
 * to apps/api would work but adds real latency and complexity to the
 * most latency-sensitive, most security-sensitive path in the app for
 * no benefit — the adapter already knows how to talk to Postgres
 * directly, safely, without inventing anything hand-rolled.
 *
 * Server-only: this file (and DATABASE_URL, which has no NEXT_PUBLIC_
 * prefix) is never bundled into client-side JS — confirmed as part of
 * the Day 16 secrets audit, see drops/README.md.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 5), // small — this process only ever touches 4 tables, nothing like apps/api's full workload
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Same crash-prevention fix as apps/api/src/db/db.provider.ts, same
// reason: an unhandled 'error' on an idle client would otherwise throw
// uncaught and kill this Next.js process on any transient DB blip.
pool.on('error', (err) => {
  console.error('[authDbPool] idle client error:', err.message);
});

export const authDb = drizzle(pool, { schema });
export { pool as authPool };
