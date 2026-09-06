import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

/**
 * Applies the hand-authored SQL files in drizzle/, in filename order,
 * each exactly once, each in its own transaction.
 *
 * Why not drizzle-kit's generate + migrator: the DDL here is partitioned
 * tables and a plpgsql function, neither of which drizzle-kit can emit
 * from the schema DSL. Generating and then hand-editing every migration
 * leaves two sources of truth that drift. So Drizzle owns the typed query
 * layer and these files own the physical layout — drizzle-kit stays
 * available for diffing the schema when that's useful.
 *
 * Replaces Day 5's single CREATE TABLE IF NOT EXISTS, which noted it
 * should be revisited "once the schema grows past a couple of tables."
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const dir = resolveMigrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query<{ name: string }>('SELECT name FROM _migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Sent as one simple query: these files contain $$-quoted function
      // bodies, so splitting on semicolons would corrupt them.
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`, { cause: err });
    } finally {
      client.release();
    }
  }
}

/**
 * Keeps this month's and next month's price_snapshots partitions in
 * existence. Separate from migrations on purpose: migrations run once,
 * this has to run on every boot, forever, or writes eventually land in
 * the default partition.
 */
export async function ensurePricePartitions(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ result: string }>(
    `SELECT ensure_price_snapshot_partition(CURRENT_DATE) AS result
     UNION ALL
     SELECT ensure_price_snapshot_partition((CURRENT_DATE + INTERVAL '1 month')::DATE)`,
  );
  for (const r of rows) console.log(`[partitions] ${r.result}`);
}

/**
 * dist/ mirrors src/, so the compiled file sits two levels below the
 * package root either way — but .sql files aren't compiled, so the
 * folder is resolved relative to the package rather than to __dirname's
 * build output.
 */
function resolveMigrationsDir(): string {
  return join(__dirname, '..', '..', 'drizzle');
}
