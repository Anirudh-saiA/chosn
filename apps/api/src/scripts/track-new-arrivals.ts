/**
 * "Just landed" tracking, run after each import:  node --env-file=.env dist/scripts/track-new-arrivals.js
 *
 * Records the first day each store listed each in-stock shoe (listing_first_seen). A store seen for the very first time is baseline-only:
 * everything it already carries is marked is_baseline, so onboarding a store never looks like a flood of releases. From then on, a shoe
 * that appears at that store for the first time is a real new arrival, and the Releases page shows it for a couple of weeks.
 */
import { Pool } from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const day = (await pool.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d`)).rows[0].d as string;
    // Stores that already have rows are "known"; anything else is on its first run and becomes a baseline.
    const res = await pool.query(
      `WITH live AS (
         SELECT DISTINCT v.sneaker_id, ps.retailer_id
           FROM price_snapshots ps JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
          WHERE ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'),
       known AS (SELECT DISTINCT f.retailer_id FROM listing_first_seen f)
       INSERT INTO listing_first_seen (sneaker_id, retailer_id, first_seen, is_baseline)
       SELECT l.sneaker_id, l.retailer_id, $1::date, NOT EXISTS (SELECT 1 FROM known k WHERE k.retailer_id = l.retailer_id)
         FROM live l
       ON CONFLICT (sneaker_id, retailer_id) DO NOTHING`,
      [day],
    );
    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE NOT is_baseline AND first_seen >= $1::date - 14)::int AS landed_14d,
              count(DISTINCT retailer_id) FILTER (WHERE NOT is_baseline)::int AS stores_with_arrivals,
              count(*)::int AS tracked
         FROM listing_first_seen`,
      [day],
    );
    console.log(`[arrivals] ${res.rowCount ?? 0} new store listings recorded for ${day};`, rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
