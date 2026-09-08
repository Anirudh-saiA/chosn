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
  publishedAt: string;
  dropEventId: string | null;
  /** Denormalized for cross-linking (task 5) without a second round trip per card. */
  dropSneaker: { styleCode: string; brand: string; model: string } | null;
}

export interface NewsListResponse {
  items: NewsListItem[];
  total: number;
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

  async list(params: { limit?: number; offset?: number; dropEventId?: string } = {}): Promise<NewsListResponse> {
    const limit = Math.min(params.limit && params.limit > 0 ? params.limit : DEFAULT_LIMIT, MAX_LIMIT);
    const offset = params.offset && params.offset > 0 ? params.offset : 0;

    const where = params.dropEventId ? sql`WHERE n.drop_event_id = ${params.dropEventId}` : sql``;

    const { rows } = await this.db.execute(sql`
      SELECT n.id, n.title, n.body, n.source, n.source_url, n.is_breaking, n.published_at,
             n.drop_event_id, s.style_code, s.brand, s.model,
             count(*) OVER() AS total
      FROM news_items n
      LEFT JOIN drop_events de ON de.id = n.drop_event_id
      LEFT JOIN sneakers s ON s.id = de.sneaker_id
      ${where}
      ORDER BY n.published_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? Number((rows[0] as Record<string, unknown>).total) : 0;
    return { items: (rows as Record<string, unknown>[]).map(rowToItem), total };
  }

  async getById(id: string): Promise<NewsListItem | null> {
    const { rows } = await this.db.execute(sql`
      SELECT n.id, n.title, n.body, n.source, n.source_url, n.is_breaking, n.published_at,
             n.drop_event_id, s.style_code, s.brand, s.model
      FROM news_items n
      LEFT JOIN drop_events de ON de.id = n.drop_event_id
      LEFT JOIN sneakers s ON s.id = de.sneaker_id
      WHERE n.id = ${id}
      LIMIT 1
    `);
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? rowToItem(row) : null;
  }
}

function rowToItem(row: Record<string, unknown>): NewsListItem {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    source: String(row.source),
    sourceUrl: (row.source_url as string) ?? null,
    isBreaking: Boolean(row.is_breaking),
    publishedAt: new Date(row.published_at as string).toISOString(),
    dropEventId: (row.drop_event_id as string) ?? null,
    dropSneaker: row.style_code
      ? { styleCode: String(row.style_code), brand: String(row.brand), model: String(row.model) }
      : null,
  };
}
