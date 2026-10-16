/**
 * Saves the live offers read by scripts/scrape_store_offers.py onto each retailer.
 *
 *   node --env-file=.env dist/scripts/import-store-offers.js offers.json
 *
 * The file is { "<retailer slug>": [{ "text": "...", "url": "..." }] }. A store listed with an empty list has
 * its offers cleared (the banner is gone); a store missing from the file is left as it was. Needs DATABASE_URL.
 */
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: import-store-offers <offers.json>');
    process.exit(1);
  }
  const offers = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Array<{ text: string; url?: string }>>;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const [slug, list] of Object.entries(offers)) {
      const clean = list.filter((o) => typeof o.text === 'string' && o.text.length > 0).slice(0, 5);
      const res = await pool.query('UPDATE retailers SET offers = $1::jsonb, offers_updated_at = now() WHERE slug = $2', [JSON.stringify(clean), slug]);
      console.log(`${slug}: ${res.rowCount ? `${clean.length} offer(s) saved` : 'no such store'}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
