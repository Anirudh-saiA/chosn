import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

export interface NewsListItem {
  id: string;
  title: string;
  body: string;
  source: string;
  sourceUrl: string | null;
  isBreaking: boolean;
  /** true = gathered from another site's public feed (headline, excerpt and a link out); false = our own writing. */
  external: boolean;
  publishedAt: string;
  dropEventId: string | null;
  /** Tags (scripts/tag-news.ts): brands the story names, what kind of story it is, whether it is about India. */
  brands: string[];
  category: 'release' | 'collab' | 'culture' | 'industry' | null;
  india: boolean;
  /** The shoe the story is about, as a Compare search ("Nike Air Max 90 SP"). */
  shoeQuery: string | null;
  /** Other sites that ran the same story (near-duplicates folded into this one). */
  alsoCoveredBy: string[];
  /** Denormalized for cross-linking (task 5) without a second round trip per card. */
  dropSneaker: { styleCode: string; brand: string; model: string } | null;
}

export interface NewsListResponse {
  items: NewsListItem[];
  total: number;
  /** For the gathered feed (external=1): every site stories have been gathered from. */
  sources?: string[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Read layer for the news feed (Day 15) over `news_items` — Day 13's
 * auto-post consumer is still the only writer. Every article's full
 * `body` comes back on both the list and single-item read: at today's
 * scale (short, auto-generated announcements) there's no separate
 * "excerpt" worth maintaining — the feed card just truncates what's
 * already there.
 */
@Injectable()
export class NewsService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async list(params: { limit?: number; offset?: number; dropEventId?: string; external?: string; brand?: string; category?: string; sort?: string } = {}): Promise<NewsListResponse> {
    const limit = Math.min(params.limit && params.limit > 0 ? params.limit : DEFAULT_LIMIT, MAX_LIMIT);
    const offset = params.offset && params.offset > 0 ? params.offset : 0;

    const conds = [];
    if (params.dropEventId) conds.push(sql`n.drop_event_id = ${params.dropEventId}`);
    if (params.external === '1') conds.push(sql`n.external`);
    if (params.external === '0') conds.push(sql`NOT n.external`);
    if (!showDemo()) conds.push(sql`NOT n.is_demo AND (n.drop_event_id IS NULL OR NOT de.is_demo)`);
    conds.push(sql`n.dup_of IS NULL`);
    if (params.brand) conds.push(sql`${params.brand} = ANY(n.brands)`);
    if (params.category) conds.push(sql`n.category = ${params.category}`);
    const where = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;

    const { rows } = await this.db.execute(sql`
      SELECT n.id, n.title, n.body, n.source, n.source_url, n.is_breaking, n.external, n.published_at,
             n.drop_event_id, n.brands, n.category, n.india, n.shoe_query, s.style_code, s.brand, s.model,
             ${ALSO} AS also, count(*) OVER() AS total
      FROM news_items n
      LEFT JOIN drop_events de ON de.id = n.drop_event_id
      LEFT JOIN sneakers s ON s.id = de.sneaker_id
      ${where}
      ORDER BY ${params.sort === 'relevance' ? RELEVANCE : sql`n.published_at DESC`}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? Number((rows[0] as Record<string, unknown>).total) : 0;
    const sources = params.external === '1' ? ((await this.db.execute(sql`SELECT DISTINCT source FROM news_items WHERE external ORDER BY 1`)).rows as Array<{ source: string }>).map((r) => r.source) : undefined;
    return { items: (rows as Record<string, unknown>[]).map(rowToItem), total, sources };
  }

  async getById(id: string): Promise<NewsListItem | null> {
    const { rows } = await this.db.execute(sql`
      SELECT n.id, n.title, n.body, n.source, n.source_url, n.is_breaking, n.external, n.published_at,
             n.drop_event_id, n.brands, n.category, n.india, n.shoe_query, s.style_code, s.brand, s.model, ${ALSO} AS also
      FROM news_items n
      LEFT JOIN drop_events de ON de.id = n.drop_event_id
      LEFT JOIN sneakers s ON s.id = de.sneaker_id
      WHERE n.id = ${id}
        ${showDemo() ? sql`` : sql`AND NOT n.is_demo AND (n.drop_event_id IS NULL OR NOT de.is_demo)`}
      LIMIT 1
    `);
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? rowToItem(row) : null;
  }
}

/** Sources of the near-duplicate stories folded into this one. */
const ALSO = sql`COALESCE((SELECT array_agg(DISTINCT d.source) FROM news_items d WHERE d.dup_of = n.id), '{}')`;

/**
 * "Top stories" order: every bonus fades with age (halved after two days), so fresh beats old; then our own writing and breaking news come first, and a story that names a brand, a shoe we track or a
 * drop on our calendar, or that several sites ran, ranks higher.
 */
const RELEVANCE = sql`(
  (6.0 + CASE WHEN n.is_breaking THEN 3 ELSE 0 END + CASE WHEN NOT n.external THEN 1.5 ELSE 0 END
   + CASE WHEN n.shoe_query IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN n.drop_event_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN cardinality(n.brands) > 0 THEN 0.5 ELSE 0 END + CASE WHEN n.india THEN 0.5 ELSE 0 END
   + LEAST(1.5, 0.5 * (SELECT count(*) FROM news_items d WHERE d.dup_of = n.id)))
  / (1 + extract(epoch FROM now() - n.published_at) / 86400.0 / 2.0)
) DESC, n.published_at DESC`;

/** text[] columns come back from node-postgres as real arrays. */
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

const showDemo = () => process.env.SHOW_DEMO_RELEASES === '1';

function rowToItem(row: Record<string, unknown>): NewsListItem {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    source: String(row.source),
    sourceUrl: (row.source_url as string) ?? null,
    isBreaking: Boolean(row.is_breaking),
    external: Boolean(row.external),
    publishedAt: new Date(row.published_at as string).toISOString(),
    dropEventId: (row.drop_event_id as string) ?? null,
    brands: asList(row.brands),
    category: (row.category as NewsListItem['category']) ?? null,
    india: Boolean(row.india),
    shoeQuery: (row.shoe_query as string) ?? null,
    alsoCoveredBy: asList(row.also),
    dropSneaker: row.style_code
      ? { styleCode: String(row.style_code), brand: String(row.brand), model: String(row.model) }
      : null,
  };
}
