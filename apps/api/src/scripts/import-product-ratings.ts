/**
 * Saves each shoe's store rating (as scripts/scrape_myntra_prices.py read it) into retailer_product_ratings.
 *
 *   node --env-file=.env dist/scripts/import-product-ratings.js myntra-ratings.json [retailer-slug=myntra]
 *
 * The file is [{ "url": "<listing url>", "rating": 4.36, "ratingCount": 56 }]. Each URL is matched to the shoe through
 * the listing url saved with its prices, so run this after the prices are imported. Products with no rating are skipped
 * (no rating is ever made up). Needs DATABASE_URL.
 */
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

interface Entry {
  url: string;
  rating: number | null;
  ratingCount: number | null;
}

async function main() {
  const file = process.argv[2];
  const slug = process.argv[3] ?? 'myntra';
  if (!file) {
    console.error('Usage: import-product-ratings <ratings.json> [retailer-slug]');
    process.exit(1);
  }
  const entries = (JSON.parse(readFileSync(file, 'utf8')) as Entry[]).filter(
    (e) => typeof e.url === 'string' && typeof e.rating === 'number' && e.rating > 0 && typeof e.ratingCount === 'number' && e.ratingCount > 0,
  );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(
      `INSERT INTO retailer_product_ratings (sneaker_id, retailer_id, rating, rating_count, source_url, fetched_at)
       SELECT DISTINCT ON (s.id, r.id) s.id, r.id, d.rating, d.cnt, d.url, now()
         FROM unnest($1::text[], $2::numeric[], $3::int[]) AS d(url, rating, cnt)
         JOIN price_snapshots ps ON ps.listing_url = d.url AND ps.is_latest = true
         JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
         JOIN sneakers s ON s.id = v.sneaker_id
         JOIN retailers r ON r.id = ps.retailer_id AND r.slug = $4
        ORDER BY s.id, r.id, d.cnt DESC
       ON CONFLICT (sneaker_id, retailer_id)
       DO UPDATE SET rating = EXCLUDED.rating, rating_count = EXCLUDED.rating_count, source_url = EXCLUDED.source_url, fetched_at = now()`,
      [entries.map((e) => e.url), entries.map((e) => e.rating), entries.map((e) => e.ratingCount), slug],
    );
    console.log(`${slug}: ${res.rowCount ?? 0} shoe rating(s) saved from ${entries.length} rated product(s)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
