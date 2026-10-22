/**
 * Learn the base rates behind the Buy now / Wait outlook:  node --env-file=.env dist/scripts/compute-outlook-priors.js
 *
 * For every shoe-size with at least 3 days of price history in the last 14 days: did its best price fall by 5% or more after the first
 * day of that window? Grouped by brand and price band (and overall). A group needs 50+ shoes to be used. The window is simply as much
 * history as exists (up to 14 days), and is stored with the rate so the page can say exactly what was measured.
 */
import { Pool } from 'pg';

const BANDS = `CASE WHEN p0 < 3000 THEN 'under3k' WHEN p0 < 6000 THEN '3-6k' WHEN p0 < 10000 THEN '6-10k' WHEN p0 < 20000 THEN '10-20k' ELSE '20k+' END`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM price_outlook_priors');
    const base = `
      WITH w AS (
        SELECT sneaker_variant_id v, day, best_price_inr::float p FROM daily_best_prices WHERE day >= current_date - 14
      ), f AS (
        SELECT DISTINCT ON (v) v, p AS p0, day AS d0 FROM w ORDER BY v, day
      ), a AS (
        SELECT f.v, f.p0, min(w.p) FILTER (WHERE w.day > f.d0) AS pmin, count(*) AS n_days, max(w.day) - min(w.day) AS span
        FROM w JOIN f ON f.v = w.v GROUP BY f.v, f.p0
      ), g AS (
        SELECT s.brand, ${BANDS} AS band, (a.pmin <= a.p0 * 0.95) AS dropped, a.span
        FROM a JOIN sneaker_variants sv ON sv.id = a.v JOIN sneakers s ON s.id = sv.sneaker_id
        WHERE a.n_days >= 3 AND a.p0 > 0
      )`;
    await pool.query(`${base} INSERT INTO price_outlook_priors (brand, band, n, drop_share, window_days)
      SELECT brand, band, count(*), avg(dropped::int), greatest(1, round(avg(span))) FROM g GROUP BY brand, band HAVING count(*) >= 50`);
    await pool.query(`${base} INSERT INTO price_outlook_priors (brand, band, n, drop_share, window_days)
      SELECT '*', band, count(*), avg(dropped::int), greatest(1, round(avg(span))) FROM g GROUP BY band HAVING count(*) >= 50`);
    await pool.query(`${base} INSERT INTO price_outlook_priors (brand, band, n, drop_share, window_days)
      SELECT '*', '*', count(*), avg(dropped::int), greatest(1, round(avg(span))) FROM g HAVING count(*) >= 50`);
    await pool.query('COMMIT');
    const { rows } = await pool.query(`SELECT brand, band, n, round(drop_share::numeric, 3) AS drop_share, window_days FROM price_outlook_priors ORDER BY (brand = '*') DESC, n DESC LIMIT 12`);
    console.table(rows);
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
