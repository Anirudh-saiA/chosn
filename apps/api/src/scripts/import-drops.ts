/**
 * Enter confirmed upcoming drops:  node --env-file=.env dist/scripts/import-drops.js [path]   (default data/releases/upcoming.json)
 *
 * Every drop needs a source it was confirmed by (a brand or retailer page, or a named publication): CHOSN lists confirmed dates only,
 * never rumours. See data/releases/README.md for the file format. A drop is matched to a shoe we track by style code; one we do not
 * track is reported and skipped. Re-running updates the same drop (same shoe + date) instead of duplicating it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

interface DropIn {
  styleCode?: string;
  releaseDate?: string;
  releaseTime?: string;
  retailPrice?: number;
  regions?: string[];
  sourceName?: string;
  sourceUrl?: string;
  links?: Array<{ label?: string; url?: string }>;
  raffle?: { opensAt?: string; closesAt?: string; url?: string; note?: string } | null;
}

const REGIONS = new Set(['india', 'us', 'global']);
const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u);

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const file = resolve(process.argv[2] ?? resolve(process.cwd(), '../../data/releases/upcoming.json'));
  const list = JSON.parse(readFileSync(file, 'utf8')) as DropIn[];
  if (!Array.isArray(list)) throw new Error('the file must be a JSON array of drops');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let saved = 0;
  const problems: string[] = [];
  try {
    for (const [i, d] of list.entries()) {
      const tag = `#${i + 1} ${d.styleCode ?? '?'}`;
      if (!d.styleCode || !/^[A-Za-z0-9._-]{3,40}$/.test(d.styleCode)) { problems.push(`${tag}: styleCode missing or invalid`); continue; }
      if (!d.releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(d.releaseDate)) { problems.push(`${tag}: releaseDate must be YYYY-MM-DD`); continue; }
      if (d.releaseTime && !/^\d{2}:\d{2}$/.test(d.releaseTime)) { problems.push(`${tag}: releaseTime must be HH:MM (India time)`); continue; }
      if (!d.sourceName || !https(d.sourceUrl)) { problems.push(`${tag}: sourceName and an https sourceUrl are required (confirmed drops only)`); continue; }
      const regions = (d.regions && d.regions.length ? d.regions : ['india']).filter((r) => REGIONS.has(r));
      const links = (d.links ?? []).filter((l) => l.label && https(l.url)).map((l) => ({ label: l.label, url: l.url }));
      const shoe = await pool.query('SELECT id FROM sneakers WHERE style_code = $1', [d.styleCode]);
      if (shoe.rowCount === 0) { problems.push(`${tag}: we do not track this style code yet`); continue; }
      const sneakerId = shoe.rows[0].id as string;
      const existing = await pool.query('SELECT id FROM drop_events WHERE sneaker_id = $1 AND release_date = $2::date', [sneakerId, d.releaseDate]);
      const raffle = d.raffle ? JSON.stringify(d.raffle) : null;
      if (existing.rowCount) {
        await pool.query(
          `UPDATE drop_events SET release_time = $2::time, retail_price = $3, regions = $4::region[], purchase_links = $5::jsonb, raffle_info = $6::jsonb,
                  source_name = $7, source_url = $8, is_demo = false, updated_at = now() WHERE id = $1`,
          [existing.rows[0].id, d.releaseTime ?? null, d.retailPrice ?? null, regions, JSON.stringify(links), raffle, d.sourceName, d.sourceUrl],
        );
      } else {
        await pool.query(
          `INSERT INTO drop_events (sneaker_id, release_date, release_time, regions, retail_price, purchase_links, raffle_info, source_name, source_url, is_demo)
           VALUES ($1, $2::date, $3::time, $4::region[], $5, $6::jsonb, $7::jsonb, $8, $9, false)`,
          [sneakerId, d.releaseDate, d.releaseTime ?? null, regions, d.retailPrice ?? null, JSON.stringify(links), raffle, d.sourceName, d.sourceUrl],
        );
      }
      saved++;
    }
  } finally {
    await pool.end();
  }
  console.log(`[drops] ${saved} saved, ${problems.length} skipped`);
  for (const p of problems) console.log('  -', p);
  if (problems.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
