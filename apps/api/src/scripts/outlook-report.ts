/**
 * Scorecard for the Buy now / Wait outlook:  node --env-file=.env dist/scripts/outlook-report.js
 * Per verdict: how many predictions were logged, how many have a 14 / 30 day outcome, and how often the price then fell 5%+ or rose 5%+.
 * A useful outlook shows "Wait" followed by more falls than "Buy now" is. Until outcomes exist (14+ days after the first log) it just counts.
 */
import { Pool } from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(`
      SELECT verdict, count(*)::int AS logged,
             count(*) FILTER (WHERE fell_5pct_14 IS NOT NULL)::int AS with_14d,
             round(100 * avg(fell_5pct_14::int)::numeric, 1) AS fell_14d_pct,
             round(100 * avg(rose_5pct_14::int)::numeric, 1) AS rose_14d_pct,
             count(*) FILTER (WHERE fell_5pct_30 IS NOT NULL)::int AS with_30d,
             round(100 * avg(fell_5pct_30::int)::numeric, 1) AS fell_30d_pct,
             round(100 * avg(rose_5pct_30::int)::numeric, 1) AS rose_30d_pct
        FROM outlook_log GROUP BY verdict ORDER BY verdict`);
    console.table(rows);
    const { rows: span } = await pool.query(`SELECT min(logged_on)::text AS first, max(logged_on)::text AS last, count(DISTINCT logged_on)::int AS days FROM outlook_log`);
    console.log('log covers', span[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
