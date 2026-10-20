import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { isUUID } from 'class-validator';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { DropsService, showDemo, type DropDetail, type DropListItem, type DropStatus } from './drops.service';
import { ListDropsQueryDto } from './dto/list-drops-query.dto';
import { parsePgTextArray } from './pg-array';

export interface DropEventSummary {
  id: string;
  status: DropStatus;
  releaseDate: string;
  releaseTime: string | null;
  releaseTimezone: string;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  purchaseLinks: unknown;
  raffleInfo: unknown;
}

/** Read-only, public — a drop's own status/detail is not sensitive. */
@Controller('drops')
export class DropsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly drops: DropsService,
  ) {}

  /**
   * Day 15's calendar/list view. `from`/`to` are `YYYY-MM-DD`; `status`
   * is a comma-separated subset of upcoming/live/sold_out. All optional
   * — omitting everything returns every drop (fine at this catalog's
   * scale, see DropsService.list's own comment).
   *
   * Day 16 task 5 fix: `from`/`to` used to reach `DropsService.list()`'s
   * raw SQL unvalidated — a malformed date string became a raw Postgres
   * "invalid input syntax for type date" 500, the same class of bug as
   * catalog/search's limit/offset (see that DTO's own comment).
   * `ListDropsQueryDto` closes it with a clean 400 instead.
   */
  @Get()
  async list(@Query() query: ListDropsQueryDto): Promise<DropListItem[]> {
    return this.drops.list({ from: query.from, to: query.to, statuses: query.status });
  }

  /**
   * The most relevant drop for a sneaker: a 'live' row wins over
   * 'upcoming' (which wins over 'sold_out'), and among ties the
   * soonest/most recent release_date. Most sneakers have zero or one
   * drop_event today: this returns the single row worth showing
   * whenever more than one exists (e.g. a restock).
   *
   * Declared before `:id` below — a static-prefix route ahead of a
   * dynamic one-segment route, the same defensive convention
   * CatalogController's own comment describes. The two don't actually
   * collide today (different segment counts), but this is the
   * convention that stays unambiguous if either route's shape changes.
   */
  /**
   * Every drop as an iCalendar file, so the whole calendar can be added to Google / Apple / Outlook calendar (and re-read as it changes).
   * Date-only drops are all-day events; a drop with a time is a timed event. The summary says how firm the date is.
   */
  @Get('calendar.ics')
  async calendar(@Res() res: Response): Promise<void> {
    const drops = await this.drops.list({});
    const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const fold = (l: string) => (l.length <= 74 ? l : l.match(/.{1,73}/g)!.join('\r\n '));
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CHOSN//Drops//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:CHOSN drops', 'X-WR-TIMEZONE:Asia/Kolkata'];
    for (const d of drops) {
      const day = d.releaseDate.replace(/-/g, '');
      const level = d.confirmation === 'confirmed' ? 'Confirmed' : d.confirmation === 'reported' ? 'Reported' : 'Unconfirmed';
      const price = d.retailPrice ? `${d.currency} ${Number(d.retailPrice).toLocaleString('en-US')}` : 'price TBA';
      lines.push('BEGIN:VEVENT', `UID:${d.id}@chosn`, `DTSTAMP:${stamp}`);
      if (d.releaseTime && d.releaseTimezone === 'Asia/Kolkata') {
        const [h, m] = d.releaseTime.split(':').map(Number);
        const utc = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)), (h ?? 0) - 5, (m ?? 0) - 30));
        lines.push(`DTSTART:${utc.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`, 'DURATION:PT1H');
      } else {
        const next = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)) + 1));
        lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
      }
      lines.push(
        `SUMMARY:${esc(`${d.sneaker.brand} ${d.sneaker.model} ${d.sneaker.colorway === 'Default' ? '' : d.sneaker.colorway}`.trim())} (${level.toLowerCase()})`,
        `DESCRIPTION:${esc(`${level} date. ${price}. Regions: ${d.regions.join(', ') || 'n/a'}.${d.sourceName ? ` Source: ${d.sourceName}${d.sourceUrl ? ` ${d.sourceUrl}` : ''}.` : ''}`)}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chosn-drops.ics"');
    res.send(lines.map(fold).join('\r\n') + '\r\n');
  }

  @Get('by-style-code/:styleCode')
  async byStyleCode(@Param('styleCode') styleCode: string): Promise<DropEventSummary | null> {
    const { rows } = await this.db.execute(sql`
      SELECT de.id, de.status, de.release_date, de.release_time, de.release_timezone,
             de.regions, de.retail_price, de.currency, de.purchase_links, de.raffle_info
      FROM drop_events de
      JOIN sneakers s ON s.id = de.sneaker_id
      WHERE s.style_code = ${styleCode} ${showDemo() ? sql`` : sql`AND NOT de.is_demo`}
      ORDER BY
        CASE de.status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
        de.release_date DESC
      LIMIT 1
    `);

    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: String(row.id),
      status: row.status as DropStatus,
      releaseDate: String(row.release_date),
      releaseTime: (row.release_time as string) ?? null,
      releaseTimezone: String(row.release_timezone),
      regions: parsePgTextArray(row.regions as string | null),
      retailPrice: (row.retail_price as string) ?? null,
      currency: String(row.currency),
      purchaseLinks: row.purchase_links,
      raffleInfo: row.raffle_info,
    };
  }

  /** The drop-detail page (Day 15 task 3) — sneaker info, official links, related news, and the variant to check for a Market Intelligence preview once live. */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<DropDetail> {
    // A non-UUID id would otherwise reach the database and come back as
    // a raw "invalid input syntax for type uuid" 500 — validated here
    // instead so a malformed/garbage id 404s cleanly like a real
    // not-found does, matching how CatalogController 404s a
    // non-numeric size rather than letting Postgres reject it.
    if (!isUUID(id)) {
      throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    }
    const drop = await this.drops.getById(id);
    if (!drop) throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    return drop;
  }
}
