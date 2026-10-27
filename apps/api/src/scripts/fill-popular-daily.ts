/**
 * Nightly popularity fill:  node --env-file=.env dist/scripts/fill-popular-daily.js [days]
 * Turns offer_events (views and Buy clicks) into popular_daily(day, style_code, views, clicks) for the last `days` days (default 3, max 120).
 * Safe to run twice; a backfill of older days is `... fill-popular-daily.js 90`. /catalog/budget?sort=trending reads the table.
 */
import { Pool } from 'pg';
import { fillPopularDaily } from '../catalog/popular-daily';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const out = await fillPopularDaily((text, params) => pool.query(text, params), process.argv[2]);
    console.log(`popular_daily: ${out.rows} shoe-days written for the last ${out.days} day(s)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
