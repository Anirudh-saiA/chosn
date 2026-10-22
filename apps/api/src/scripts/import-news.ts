/**
 * Add news stories:  node --env-file=.env dist/scripts/import-news.js [path]   (default data/releases/news.json)
 *
 * Each story is written in CHOSN's own words from the source it names, and links back to it: never copy an article, always credit and
 * link. Required: title, body, publishedAt (YYYY-MM-DD), sourceName and an https sourceUrl. Re-running updates a story with the same
 * title instead of duplicating it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

interface NewsIn {
  title?: string;
  body?: string;
  publishedAt?: string;
  sourceName?: string;
  sourceUrl?: string;
  breaking?: boolean;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const file = resolve(process.argv[2] ?? resolve(process.cwd(), '../../data/releases/news.json'));
  const list = JSON.parse(readFileSync(file, 'utf8')) as NewsIn[];
  if (!Array.isArray(list)) throw new Error('the file must be a JSON array of stories');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let saved = 0;
  const problems: string[] = [];
  try {
    for (const [i, n] of list.entries()) {
      const tag = `#${i + 1} ${n.title ?? '?'}`;
      if (!n.title || n.title.length > 200 || !n.body || n.body.length < 40) { problems.push(`${tag}: title and a body of at least 40 characters are required`); continue; }
      if (!n.publishedAt || !/^\d{4}-\d{2}-\d{2}$/.test(n.publishedAt)) { problems.push(`${tag}: publishedAt must be YYYY-MM-DD`); continue; }
      if (!n.sourceName || !/^https:\/\/[^\s]+$/.test(n.sourceUrl ?? '')) { problems.push(`${tag}: sourceName and an https sourceUrl are required`); continue; }
      const source = `CHOSN, from ${n.sourceName}`;
      const found = await pool.query('SELECT id FROM news_items WHERE title = $1 AND NOT is_demo', [n.title]);
      if (found.rowCount) {
        await pool.query(`UPDATE news_items SET body = $2, published_at = $3::date, source = $4, source_url = $5, is_breaking = $6 WHERE id = $1`, [found.rows[0].id, n.body, n.publishedAt, source, n.sourceUrl, n.breaking === true]);
      } else {
        await pool.query(
          `INSERT INTO news_items (title, body, published_at, source, source_url, is_breaking, is_demo) VALUES ($1, $2, $3::date, $4, $5, $6, false)`,
          [n.title, n.body, n.publishedAt, source, n.sourceUrl, n.breaking === true],
        );
      }
      saved++;
    }
  } finally {
    await pool.end();
  }
  console.log(`[news] ${saved} saved, ${problems.length} skipped`);
  for (const p of problems) console.log('  -', p);
  if (problems.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
