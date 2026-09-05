import type { Pool } from 'pg';

/**
 * No migration framework yet — one table, one idempotent statement, run
 * automatically at boot (see main.ts). Revisit with a real tool
 * (node-pg-migrate, Prisma, etc.) once the schema grows past a couple
 * of tables; a single CREATE TABLE IF NOT EXISTS doesn't earn one yet.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waitlist_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      interests TEXT[] NOT NULL DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'landing_page',
      confirmed BOOLEAN NOT NULL DEFAULT true,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
