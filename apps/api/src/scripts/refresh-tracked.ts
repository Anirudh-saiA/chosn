/**
 * Nightly tracked-shoe refresh:  node --env-file=.env dist/scripts/refresh-tracked.js
 * tracked = real sneaker, top brand, in stock at 2 or more stores. Same rule as drizzle/0053_tracked.sql.
 */
import { Pool } from 'pg';

const BRANDS = ['nike', 'adidas', 'new balance', 'jordan', 'puma', 'converse', 'asics'];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(
      `UPDATE sneakers s SET tracked = (
         s.footwear_type = 'sneaker' AND lower(s.brand) = ANY($1)
         AND s.id IN (
           SELECT v.sneaker_id FROM price_snapshots p JOIN sneaker_variants v ON v.id = p.sneaker_variant_id
           WHERE p.is_latest AND p.in_stock GROUP BY v.sneaker_id HAVING count(DISTINCT p.retailer_id) >= 2)
       ) WHERE s.tracked IS DISTINCT FROM (
         s.footwear_type = 'sneaker' AND lower(s.brand) = ANY($1)
         AND s.id IN (
           SELECT v.sneaker_id FROM price_snapshots p JOIN sneaker_variants v ON v.id = p.sneaker_variant_id
           WHERE p.is_latest AND p.in_stock GROUP BY v.sneaker_id HAVING count(DISTINCT p.retailer_id) >= 2))`,
      [BRANDS],
    );
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM sneakers WHERE tracked');
    console.log(`tracked shoes: ${rows[0].n}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
