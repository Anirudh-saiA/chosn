/**
 * Standalone migration run — `npm run db:migrate --workspace=@chosn/api`.
 *
 * Boot also migrates (see main.ts), but having it as its own command
 * means migrations can be run and verified without starting a server,
 * which is what CI and a deploy step actually want.
 */
import { Pool } from 'pg';
import { ensurePricePartitions, runMigrations } from '../db/migrate';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await runMigrations(pool);
    await ensurePricePartitions(pool);
    console.log('[migrate] up to date');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
