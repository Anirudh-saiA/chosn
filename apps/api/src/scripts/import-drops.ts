/**
 * Enter drops:  node --env-file=.env dist/scripts/import-drops.js [path]   (default data/releases/upcoming.json)
 *
 * Every drop needs the source it came from (a brand or retailer page, a release tracker, or a named publication) and says how firm its
 * date is: confirmed (an official page states it), reported (trackers agree) or unconfirmed (one source, or sources disagree). The site
 * shows that level on every drop. See docs/releases-how-to-add-drops.md for the file format.
 *
 * A drop is matched to a shoe we track by style code. A shoe we do not track yet (most upcoming releases) is added as a bare entry
 * (brand, model, colourway; no prices, so it never appears in Compare) once `brand` and `model` are given. Past releases use
 * "status": "released". Re-running updates the same drop (same shoe + date) instead of duplicating it. A drop with no time is
 * date-only, so the scheduler never flips it live or posts news for it on its own.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

interface DropIn {
  styleCode?: string;
  brand?: string;
  model?: string;
  colorway?: string;
  collab?: string;
  releaseDate?: string;
  releaseTime?: string;
  retailPrice?: number;
  currency?: string;
  regions?: string[];
  status?: 'upcoming' | 'released';
  confirmation?: 'confirmed' | 'reported' | 'unconfirmed';
  /** From an automatic collector: never lowers a confirmation that is already higher, and a moved date is updated and flagged unconfirmed. */
  auto?: boolean;
  imageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  links?: Array<{ label?: string; url?: string }>;
  raffle?: { opensAt?: string; closesAt?: string; url?: string; note?: string } | null;
}

const REGIONS = new Set(['india', 'us', 'global']);
const LEVELS = new Set(['confirmed', 'reported', 'unconfirmed']);
const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const file = resolve(process.argv[2] ?? resolve(process.cwd(), '../../data/releases/upcoming.json'));
  const list = JSON.parse(readFileSync(file, 'utf8')) as DropIn[];
  if (!Array.isArray(list)) throw new Error('the file must be a JSON array of drops');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let saved = 0;
  let addedShoes = 0;
  const problems: string[] = [];
  try {
    for (const [i, d] of list.entries()) {
      const tag = `#${i + 1} ${d.styleCode ?? `${d.brand ?? '?'} ${d.model ?? '?'}`}`;
      if (!d.releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(d.releaseDate)) { problems.push(`${tag}: releaseDate must be YYYY-MM-DD`); continue; }
      if (d.releaseTime && !/^\d{2}:\d{2}$/.test(d.releaseTime)) { problems.push(`${tag}: releaseTime must be HH:MM (India time)`); continue; }
      if (!d.sourceName || !https(d.sourceUrl)) { problems.push(`${tag}: sourceName and an https sourceUrl are required`); continue; }
      const level = d.confirmation ?? 'confirmed';
      if (!LEVELS.has(level)) { problems.push(`${tag}: confirmation must be confirmed, reported or unconfirmed`); continue; }
      const regions = (d.regions && d.regions.length ? d.regions : ['india']).filter((r) => REGIONS.has(r));
      const links = (d.links ?? []).filter((l) => l.label && https(l.url)).map((l) => ({ label: l.label, url: l.url }));
      const currency = (d.currency ?? 'INR').toUpperCase();

      // The shoe: one we track (by style code), or a bare entry for a shoe that is not in stores yet.
      let styleCode = d.styleCode && /^[A-Za-z0-9._-]{3,40}$/.test(d.styleCode) ? d.styleCode : null;
      let shoe = styleCode ? await pool.query('SELECT id FROM sneakers WHERE style_code = $1', [styleCode]) : null;
      if (!shoe || shoe.rowCount === 0) {
        if (!d.brand || !d.model) { problems.push(`${tag}: we do not track this style code; give brand and model to add it as a bare entry`); continue; }
        styleCode ??= `DROP-${slug(`${d.brand}-${d.model}-${d.colorway ?? ''}`).slice(0, 28)}-${createHash('sha1').update(`${d.brand}|${d.model}|${d.colorway ?? ''}|${d.collab ?? ''}|${d.releaseDate}`).digest('hex').slice(0, 6)}`;
        const ins = await pool.query(
          `INSERT INTO sneakers (brand, model, colorway, style_code, currency, retail_price, release_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7::date)
           ON CONFLICT (style_code) DO UPDATE SET updated_at = now() RETURNING id, (xmax = 0) AS inserted`,
          [d.brand, d.collab ? `${d.model} x ${d.collab}` : d.model, d.colorway ?? 'Default', styleCode, currency, d.retailPrice ?? null, d.releaseDate],
        );
        if (d.imageUrl && https(d.imageUrl)) await pool.query('UPDATE sneakers SET primary_image_url = $2 WHERE id = $1 AND primary_image_url IS NULL', [ins.rows[0].id, d.imageUrl]);
        shoe = ins;
        if (ins.rows[0].inserted) addedShoes++;
      }
      const sneakerId = shoe.rows[0].id as string;
      const status = d.status === 'released' ? 'sold_out' : 'upcoming';
      let existing = await pool.query('SELECT id FROM drop_events WHERE sneaker_id = $1 AND release_date = $2::date', [sneakerId, d.releaseDate]);
      let moved = false;
      if (d.auto && !existing.rowCount && status === 'upcoming') {
        // The same shoe already has an upcoming drop on another date: the date moved. Update that drop and flag it for re-checking.
        const other = await pool.query(`SELECT id FROM drop_events WHERE sneaker_id = $1 AND status = 'upcoming' AND NOT is_demo ORDER BY abs(release_date - $2::date) LIMIT 1`, [sneakerId, d.releaseDate]);
        if (other.rowCount) {
          await pool.query('UPDATE drop_events SET release_date = $2::date WHERE id = $1', [other.rows[0].id, d.releaseDate]);
          existing = other;
          moved = true;
        }
      }
      const raffle = d.raffle ? JSON.stringify(d.raffle) : null;
      const args = [d.releaseTime ?? null, d.retailPrice ?? null, currency, regions, JSON.stringify(links), raffle, d.sourceName, d.sourceUrl, moved ? 'unconfirmed' : level, status];
      if (existing.rowCount) {
        await pool.query(
          `UPDATE drop_events SET release_time = $2::time, retail_price = $3, currency = $4, regions = $5::region[], purchase_links = $6::jsonb, raffle_info = $7::jsonb,
                  source_name = CASE WHEN $12::boolean THEN source_name ELSE $8 END, source_url = CASE WHEN $12::boolean THEN source_url ELSE $9 END,
                  confirmation = CASE WHEN $12::boolean AND NOT $13::boolean THEN confirmation ELSE $10 END, status = CASE WHEN $12::boolean THEN status ELSE $11::drop_status END, is_demo = false, updated_at = now() WHERE id = $1`,
          [existing.rows[0].id, ...args, d.auto === true, moved],
        );
      } else {
        await pool.query(
          `INSERT INTO drop_events (sneaker_id, release_date, release_time, retail_price, currency, regions, purchase_links, raffle_info, source_name, source_url, confirmation, status, is_demo)
           VALUES ($1, $2::date, $3::time, $4, $5, $6::region[], $7::jsonb, $8::jsonb, $9, $10, $11, $12::drop_status, false)`,
          [sneakerId, d.releaseDate, ...args],
        );
      }
      saved++;
    }
  } finally {
    await pool.end();
  }
  console.log(`[drops] ${saved} saved (${addedShoes} new bare shoe entries), ${problems.length} skipped`);
  for (const p of problems) console.log('  -', p);
  if (problems.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
