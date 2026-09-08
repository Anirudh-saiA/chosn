import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { parsePgTextArray } from './pg-array';

export type DropStatus = 'upcoming' | 'live' | 'sold_out';

export interface DropSneakerSummary {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
}

export interface DropListItem {
  id: string;
  status: DropStatus;
  releaseDate: string;
  releaseTime: string | null;
  releaseTimezone: string;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  sneaker: DropSneakerSummary;
}

export interface DropDetail extends DropListItem {
  purchaseLinks: unknown;
  raffleInfo: unknown;
  /** Lowest listed size for this sneaker — same convention CatalogService.search() already uses — the size this page links to for a price comparison / Market Intelligence check. */
  defaultVariant: { id: string; size: number; sizeSystem: string } | null;
  relatedNews: { id: string; title: string; publishedAt: string; isBreaking: boolean }[];
}

/**
 * Read layer for the drops magazine (Day 15) — list/detail queries on
 * top of the schema Day 12 designed and Day 13's scheduler already
 * keeps current. Nothing here writes; DropSchedulerService and the
 * consumers under drop-*.{service,consumer}.ts own every write to these
 * tables.
 */
@Injectable()
export class DropsService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * `from`/`to` bound `release_date` (inclusive) — the calendar view's
   * "this month" query. Omit both for every drop regardless of date,
   * fine at launch-catalog scale (a handful of rows) and cheap either
   * way since `drop_events_sneaker_idx`/`_status_idx` cover the table.
   * `statuses` narrows to specific statuses; omit for all three.
   */
  async list(params: { from?: string; to?: string; statuses?: DropStatus[] } = {}): Promise<DropListItem[]> {
    const conditions: ReturnType<typeof sql>[] = [];
    if (params.from) conditions.push(sql`de.release_date >= ${params.from}`);
    if (params.to) conditions.push(sql`de.release_date <= ${params.to}`);
    if (params.statuses && params.statuses.length > 0) {
      // Not `de.status = ANY(${params.statuses})` — Drizzle's sql``
      // template doesn't bind a plain JS array as a single Postgres
      // array-typed parameter (hit this exact bug twice already, Day
      // 13 and Day 14 — see drops/README.md). sql.join builds a real
      // `IN ($1, $2, ...)` list instead, each status its own parameter.
      conditions.push(
        sql`de.status IN (${sql.join(
          params.statuses.map((s) => sql`${s}`),
          sql`, `,
        )})`,
      );
    }
    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const { rows } = await this.db.execute(sql`
      SELECT de.id, de.status, de.release_date, de.release_time, de.release_timezone,
             de.regions, de.retail_price, de.currency,
             s.style_code, s.brand, s.model, s.colorway, s.primary_image_url
      FROM drop_events de
      JOIN sneakers s ON s.id = de.sneaker_id
      ${where}
      ORDER BY de.release_date ASC, de.release_time ASC NULLS LAST
    `);

    return (rows as Record<string, unknown>[]).map(rowToListItem);
  }

  async getById(id: string): Promise<DropDetail | null> {
    const { rows } = await this.db.execute(sql`
      SELECT de.id, de.status, de.release_date, de.release_time, de.release_timezone,
             de.regions, de.retail_price, de.currency, de.purchase_links, de.raffle_info,
             s.style_code, s.brand, s.model, s.colorway, s.primary_image_url
      FROM drop_events de
      JOIN sneakers s ON s.id = de.sneaker_id
      WHERE de.id = ${id}
      LIMIT 1
    `);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const styleCode = String(row.style_code);

    const [{ rows: variantRows }, { rows: newsRows }] = await Promise.all([
      this.db.execute(sql`
        SELECT sv.id, sv.size, sv.size_system
        FROM sneaker_variants sv
        JOIN sneakers s ON s.id = sv.sneaker_id
        WHERE s.style_code = ${styleCode}
        ORDER BY sv.size ASC
        LIMIT 1
      `),
      this.db.execute(sql`
        SELECT id, title, published_at, is_breaking
        FROM news_items
        WHERE drop_event_id = ${id}
        ORDER BY published_at DESC
      `),
    ]);

    const variantRow = variantRows[0] as Record<string, unknown> | undefined;

    return {
      ...rowToListItem(row),
      purchaseLinks: row.purchase_links,
      raffleInfo: row.raffle_info,
      defaultVariant: variantRow
        ? { id: String(variantRow.id), size: Number(variantRow.size), sizeSystem: String(variantRow.size_system) }
        : null,
      relatedNews: (newsRows as Record<string, unknown>[]).map((n) => ({
        id: String(n.id),
        title: String(n.title),
        publishedAt: new Date(n.published_at as string).toISOString(),
        isBreaking: Boolean(n.is_breaking),
      })),
    };
  }
}

function rowToListItem(row: Record<string, unknown>): DropListItem {
  return {
    id: String(row.id),
    status: row.status as DropStatus,
    releaseDate: String(row.release_date),
    releaseTime: (row.release_time as string) ?? null,
    releaseTimezone: String(row.release_timezone),
    regions: parsePgTextArray(row.regions as string | null),
    retailPrice: (row.retail_price as string) ?? null,
    currency: String(row.currency),
    sneaker: {
      styleCode: String(row.style_code),
      brand: String(row.brand),
      model: String(row.model),
      colorway: String(row.colorway),
      primaryImageUrl: (row.primary_image_url as string) ?? null,
    },
  };
}
