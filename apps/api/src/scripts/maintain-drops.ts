/**
 * Keep the drop calendar tidy, after each import:  node --env-file=.env dist/scripts/maintain-drops.js
 *
 *  1. Merge the same release entered two ways ("Air Force 1 Low 2026 x Oregon Ducks" and "Oregon Ducks Nike Air Force 1 Low 2026" on the
 *     same day): keep the entry that has a real style code, then a picture, then the older one; point reminders and follows at it; delete
 *     the other (and its bare shoe entry when nothing else uses it).
 *  2. Use one name for a brand ("Air Jordan" becomes "Jordan").
 *  3. Move drops whose day has passed to Released.
 */
import { Pool } from 'pg';
import { sameRelease } from '../drops/drop-names';

interface Row {
  id: string;
  sneaker_id: string;
  date: string;
  brand: string;
  model: string;
  colorway: string;
  style_code: string;
  has_image: boolean;
  created: Date;
  collab_hint: string;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const renamed = await pool.query(`UPDATE sneakers s SET brand = 'Jordan' WHERE s.brand = 'Air Jordan' AND EXISTS (SELECT 1 FROM drop_events d WHERE d.sneaker_id = s.id)`);

    const { rows } = await pool.query<Row>(
      `SELECT d.id, d.sneaker_id, d.release_date::text AS date, s.brand, s.model, s.colorway, s.style_code,
              (s.primary_image_url IS NOT NULL) AS has_image, d.created_at AS created, '' AS collab_hint
         FROM drop_events d JOIN sneakers s ON s.id = d.sneaker_id
        WHERE NOT d.is_demo AND d.status = 'upcoming'`,
    );
    const byKey = new Map<string, Row[]>();
    for (const r of rows) byKey.set(`${r.date}|${r.brand.toLowerCase()}`, [...(byKey.get(`${r.date}|${r.brand.toLowerCase()}`) ?? []), r]);
    const rank = (r: Row) => [r.style_code.startsWith('DROP-') ? 1 : 0, r.has_image ? 0 : 1, r.created.getTime()];
    const better = (a: Row, b: Row) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i]! < rb[i]!;
      return false;
    };
    let merged = 0;
    const gone = new Set<string>();
    for (const group of byKey.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i]!;
          const b = group[j]!;
          if (gone.has(a.id) || gone.has(b.id)) continue;
          if (!sameRelease({ brand: a.brand, model: a.model, colorway: a.colorway, date: a.date }, { brand: b.brand, model: b.model, colorway: b.colorway, date: b.date })) continue;
          const [keep, drop] = better(a, b) ? [a, b] : [b, a];
          await pool.query(`UPDATE drop_reminders r SET drop_id = $1 WHERE r.drop_id = $2 AND NOT EXISTS (SELECT 1 FROM drop_reminders x WHERE x.watch_id = r.watch_id AND x.drop_id = $1 AND x.minutes_before = r.minutes_before)`, [keep.id, drop.id]);
          await pool.query(`UPDATE drop_follows f SET ref = $1 WHERE f.kind = 'drop' AND f.ref = $2 AND NOT EXISTS (SELECT 1 FROM drop_follows x WHERE x.watch_id = f.watch_id AND x.kind = 'drop' AND x.ref = $1)`, [keep.id, drop.id]);
          await pool.query(`DELETE FROM drop_events WHERE id = $1`, [drop.id]);
          await pool.query(
            `DELETE FROM sneakers s WHERE s.id = $1 AND s.style_code LIKE 'DROP-%' AND NOT EXISTS (SELECT 1 FROM drop_events d WHERE d.sneaker_id = s.id) AND NOT EXISTS (SELECT 1 FROM sneaker_variants v WHERE v.sneaker_id = s.id)`,
            [drop.sneaker_id],
          );
          gone.add(drop.id);
          merged++;
          console.log(`  merged: "${drop.brand} ${drop.model} ${drop.colorway}" into "${keep.brand} ${keep.model} ${keep.colorway}" (${keep.date})`);
        }
      }
    }

    const swept = await pool.query(
      `UPDATE drop_events SET status = 'sold_out', updated_at = now()
        WHERE status IN ('upcoming', 'live') AND NOT is_demo AND (
              (release_time IS NULL AND release_date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
           OR (release_time IS NOT NULL AND (release_date + release_time) AT TIME ZONE release_timezone < now() - interval '2 days'))`,
    );
    console.log(`[drops] ${merged} duplicates merged, ${renamed.rowCount ?? 0} brand names unified, ${swept.rowCount ?? 0} moved to Released`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
