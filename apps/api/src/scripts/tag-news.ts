/**
 * Tag the news feed after each fetch:  node --env-file=.env dist/scripts/tag-news.js
 *
 *  1. Brand and category tags, and an India flag, for every story not tagged yet.
 *  2. The shoe a story is about (stored as a Compare search, e.g. "Nike Air Max 90 SP") and, when it is about a drop on our calendar,
 *     that drop (news_items.drop_event_id, only where nothing is linked yet).
 *  3. Near-duplicate removal: the same story from several sites within four days keeps one row (our own writing, else the earliest);
 *     the others point at it through dup_of and are hidden from the feed (it shows "also covered by ...").
 */
import { Pool } from 'pg';
import { categorize, detectBrands, findDuplicates, matchShoe, mentionsIndia, tokens } from '../drops/news-logic';

interface Story {
  id: string;
  title: string;
  body: string;
  source: string;
  external: boolean;
  published_at: Date;
  drop_event_id: string | null;
  tagged_at: Date | null;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: stories } = await pool.query<Story>(
      `SELECT id, title, body, source, external, published_at, drop_event_id, tagged_at FROM news_items WHERE published_at > now() - interval '45 days' AND NOT is_demo`,
    );
    const { rows: shoes } = await pool.query<{ brand: string; model: string }>(
      `SELECT DISTINCT s.brand, s.model FROM sneakers s WHERE s.style_code NOT LIKE 'DROP-%' AND EXISTS (SELECT 1 FROM sneaker_variants v WHERE v.sneaker_id = s.id)`,
    );
    const { rows: drops } = await pool.query<{ id: string; brand: string; model: string; colorway: string }>(
      `SELECT d.id, s.brand, s.model, s.colorway FROM drop_events d JOIN sneakers s ON s.id = d.sneaker_id WHERE NOT d.is_demo AND NOT d.hidden AND d.release_date >= current_date - 60`,
    );

    let tagged = 0;
    let linkedDrops = 0;
    let linkedShoes = 0;
    for (const st of stories) {
      if (st.tagged_at) continue;
      const text = `${st.title}. ${st.body.slice(0, 180)}`;
      const brands = detectBrands(text);
      const shoe = matchShoe(st.title, shoes);
      let dropId: string | null = null;
      if (!st.drop_event_id) {
        const words = new Set(tokens(st.title));
        for (const d of drops) {
          if (!matchShoe(st.title, [{ brand: d.brand, model: d.model }])) continue;
          const colour = tokens(d.colorway).filter((w) => w !== 'default');
          if (colour.length > 0 && !colour.some((w) => words.has(w))) continue;
          dropId = d.id;
          break;
        }
      }
      await pool.query(
        `UPDATE news_items SET brands = $2, category = $3, india = $4, shoe_query = $5, drop_event_id = COALESCE(drop_event_id, $6::uuid), tagged_at = now() WHERE id = $1`,
        [st.id, brands, categorize(text), mentionsIndia(text, brands), shoe ? `${shoe.brand} ${shoe.model}` : null, dropId],
      );
      tagged++;
      if (shoe) linkedShoes++;
      if (dropId) linkedDrops++;
    }

    const dup = findDuplicates(stories.map((s) => ({ id: s.id, title: s.title, publishedAt: new Date(s.published_at), source: s.source, external: s.external })));
    await pool.query(`UPDATE news_items SET dup_of = NULL WHERE dup_of IS NOT NULL AND published_at > now() - interval '45 days'`);
    for (const [id, keeper] of dup) await pool.query(`UPDATE news_items SET dup_of = $2 WHERE id = $1`, [id, keeper]);
    console.log(`[news-tags] ${tagged} stories tagged, ${linkedShoes} linked to a shoe, ${linkedDrops} to a drop, ${dup.size} duplicates hidden`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
