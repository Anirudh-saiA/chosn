import { Controller, Get, Inject, Param } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

export interface DropEventSummary {
  id: string;
  status: 'upcoming' | 'live' | 'sold_out';
  releaseDate: string;
  releaseTime: string | null;
  releaseTimezone: string;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  purchaseLinks: unknown;
  raffleInfo: unknown;
}

/**
 * Read-only, public — a drop's own status is not sensitive. Backs the
 * "Drop status" section Day 14 adds to the existing price comparison
 * page (`/sneakers/[styleCode]/[size]`), which had no way to know a
 * DropEvent even existed for that sneaker until now.
 */
@Controller('drops')
export class DropsController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * The most relevant drop for a sneaker: a 'live' row wins over
   * 'upcoming' (which wins over 'sold_out'), and among ties the
   * soonest/most recent release_date. Most sneakers have zero or one
   * drop_event today: this returns the single row worth showing
   * whenever more than one exists (e.g. a restock).
   */
  @Get('by-style-code/:styleCode')
  async byStyleCode(@Param('styleCode') styleCode: string): Promise<DropEventSummary | null> {
    const { rows } = await this.db.execute(sql`
      SELECT de.id, de.status, de.release_date, de.release_time, de.release_timezone,
             de.regions, de.retail_price, de.currency, de.purchase_links, de.raffle_info
      FROM drop_events de
      JOIN sneakers s ON s.id = de.sneaker_id
      WHERE s.style_code = ${styleCode}
      ORDER BY
        CASE de.status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
        de.release_date DESC
      LIMIT 1
    `);

    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: String(row.id),
      status: row.status as DropEventSummary['status'],
      releaseDate: String(row.release_date),
      releaseTime: (row.release_time as string) ?? null,
      releaseTimezone: String(row.release_timezone),
      regions: row.regions as string[],
      retailPrice: (row.retail_price as string) ?? null,
      currency: String(row.currency),
      purchaseLinks: row.purchase_links,
      raffleInfo: row.raffle_info,
    };
  }
}
