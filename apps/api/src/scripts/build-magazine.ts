/**
 * Print the next issue of The CHOSN Times:  node --env-file=.env dist/scripts/build-magazine.js [daily|weekly] [--force]
 *
 * Run it with the news cycle: it does nothing until an issue is due, and an issue is never changed once printed.
 *   daily   one per Indian day, printed on the first run after 06:00 IST
 *   weekly  one per ISO week, printed on Sunday after 06:00 IST (the week's Monday to Sunday); so Sunday has two issues, every other day one
 * Stories come ranked from the news table (fresh first, then brand, shoe and drop links); drops come from the calendar (rupees).
 * --force prints today's / this week's issue even before 06:00 and replaces an existing one with the same address.
 */
import { Pool } from 'pg';
import { inIndiaTime } from '../drops/drop-time';
import { assembleIssue, deck, issueSlug, youtubeId, type DropRef, type IssueKind, type StoryRef } from '../drops/magazine-logic';

const IST = 5.5 * 3_600_000;

interface StoryRow {
  id: string;
  title: string;
  body: string;
  source: string;
  source_url: string | null;
  external: boolean;
  published_at: Date;
  category: string | null;
  india: boolean;
  shoe_query: string | null;
  image_url: string | null;
  image_credit: string | null;
  image_style: 'product' | 'photo' | null;
  image_ratio: number | null;
  shoe_image: string | null;
  shoe_credit: string | null;
}

async function stories(pool: Pool, kind: IssueKind): Promise<{ list: StoryRef[]; sources: number }> {
  const half = kind === 'daily' ? 1.5 : 5;
  const run = async (days: number) =>
    pool.query<StoryRow>(
      `SELECT n.id, n.title, n.body, n.source, n.source_url, n.external, n.published_at, n.category, n.india, n.shoe_query, n.image_url, n.image_credit, n.image_style, n.image_ratio,
              s.primary_image_url AS shoe_image, s.image_credit AS shoe_credit
         FROM news_items n
         LEFT JOIN drop_events de ON de.id = n.drop_event_id
         LEFT JOIN sneakers s ON s.id = de.sneaker_id
        WHERE n.dup_of IS NULL AND NOT n.is_demo AND (n.drop_event_id IS NULL OR NOT de.is_demo) AND n.published_at > now() - ($1::numeric * interval '1 day')
        ORDER BY (6.0 + CASE WHEN n.is_breaking THEN 3 ELSE 0 END + CASE WHEN NOT n.external THEN 1.5 ELSE 0 END
                  + CASE WHEN n.shoe_query IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN n.drop_event_id IS NOT NULL THEN 1 ELSE 0 END
                  + CASE WHEN cardinality(n.brands) > 0 THEN 0.5 ELSE 0 END + CASE WHEN n.india THEN 0.5 ELSE 0 END
                  + CASE WHEN n.image_url IS NOT NULL THEN 1 ELSE 0 END)
                 / (1 + extract(epoch FROM now() - n.published_at) / 86400.0 / $2) DESC, n.published_at DESC
        LIMIT 60`,
      [days, half],
    );
  let rows = (await run(kind === 'daily' ? 1.5 : 7)).rows;
  if (kind === 'daily' && rows.length < 10) rows = (await run(4)).rows; // a quiet day: reach back a little
  const list = rows.map((r): StoryRef => ({
    id: r.id,
    title: r.title,
    deck: deck(r.body, r.title),
    source: r.source,
    kicker: r.category,
    image: r.image_url ?? r.shoe_image,
    imageCredit: r.image_url ? r.image_credit : r.shoe_credit,
    imageStyle: r.image_url ? r.image_style : 'product',
    imageRatio: r.image_url && r.image_ratio != null ? Number(r.image_ratio) : null,
    // Every headline opens its own page on our site (photo, details, compare and drop links, and a button to the publisher's full article).
    href: `/news/${r.id}`,
    external: false,
    publishedAt: new Date(r.published_at).toISOString(),
    india: r.india,
    shoeQuery: r.shoe_query,
    video: youtubeId(r.source_url),
  }));
  return { list, sources: new Set(rows.map((r) => r.source)).size };
}

async function drops(pool: Pool, kind: IssueKind): Promise<DropRef[]> {
  const fetch = async (days: number) =>
    pool.query(
      `SELECT d.id, d.release_date::text AS date, d.release_time::text AS time, d.release_timezone AS tz, d.retail_price, d.currency, d.confirmation,
              s.brand, s.model, s.colorway, s.primary_image_url AS image, fx.rate_to_inr
         FROM drop_events d JOIN sneakers s ON s.id = d.sneaker_id
         LEFT JOIN fx_rates fx ON fx.currency = d.currency AND d.currency <> 'INR'
        WHERE NOT d.is_demo AND NOT d.hidden AND d.status IN ('upcoming', 'live') AND d.release_date BETWEEN current_date AND current_date + $1::int
        ORDER BY (s.primary_image_url IS NULL), d.release_date, d.release_time NULLS LAST LIMIT 8`,
      [days],
    );
  let rows = (await fetch(kind === 'daily' ? 3 : 14)).rows;
  if (rows.length < 3) rows = (await fetch(14)).rows;
  return rows.map((r): DropRef => {
    const price = r.retail_price != null ? Number(r.retail_price) : null;
    const inr = price == null ? null : r.currency === 'INR' ? Math.round(price) : r.rate_to_inr ? Math.round(price * Number(r.rate_to_inr)) : null;
    const when = { date: String(r.date).slice(0, 10), time: r.time as string | null, timezone: String(r.tz) };
    const [y, m, dd] = when.date.split('-').map(Number);
    return {
      id: String(r.id),
      title: `${r.brand} ${r.model}${r.colorway && r.colorway !== 'Default' ? ` ${r.colorway}` : ''}`.trim(),
      brand: String(r.brand),
      dateLabel: new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, dd ?? 1)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
      timeLabel: r.time ? inIndiaTime(when).split(', ').slice(-1)[0] ?? null : null,
      priceInr: inr,
      priceNote: inr != null && r.currency !== 'INR' ? `converted from ${r.currency} ${price}` : null,
      image: (r.image as string | null) ?? null,
      confirmation: (r.confirmation as DropRef['confirmation']) ?? 'unconfirmed',
    };
  });
}

async function build(pool: Pool, kind: IssueKind, force: boolean): Promise<string> {
  const now = new Date();
  const ist = new Date(now.getTime() + IST);
  const slug = issueSlug(kind, now);
  if (!force && ist.getUTCHours() < 6) return `${kind}: not due before 06:00 IST`;
  if (!force && kind === 'weekly' && ist.getUTCDay() !== 0) return 'weekly: printed on Sundays only';
  const have = await pool.query(`SELECT 1 FROM magazine_issues WHERE slug = $1`, [slug]);
  if (have.rows.length > 0 && !force) return `${kind} ${slug}: already printed`;

  const [{ list, sources }, dropList] = await Promise.all([stories(pool, kind), drops(pool, kind)]);
  const issueNo = have.rows.length > 0
    ? Number((await pool.query(`SELECT issue_no FROM magazine_issues WHERE slug = $1`, [slug])).rows[0].issue_no)
    : Number((await pool.query(`SELECT coalesce(max(issue_no), 0) + 1 AS n FROM magazine_issues WHERE kind = $1`, [kind])).rows[0].n);
  const issue = assembleIssue({ kind, issueNo, now, stories: list, drops: dropList, sourceCount: sources });
  if (!issue) return `${kind} ${slug}: not enough to print yet`;
  await pool.query(
    `INSERT INTO magazine_issues (slug, kind, issue_no, title, period_start, period_end, pages) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, pages = EXCLUDED.pages, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, pdf_file = NULL, published_at = now()`,
    [slug, kind, issueNo, issue.title, issue.periodStart, issue.periodEnd, JSON.stringify(issue.pages)],
  );
  return `${kind} ${slug} printed: ${issue.pages.length} pages (${list.length} stories, ${dropList.length} drops)`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const kinds = (args.find((a) => a === 'daily' || a === 'weekly') ? [args.find((a) => a === 'daily' || a === 'weekly')!] : ['daily', 'weekly']) as IssueKind[];
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const k of kinds) console.log(`[magazine] ${await build(pool, k, force)}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
