import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { isUUID } from 'class-validator';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { buildIcs, googleCalendarUrl, type CalendarDrop } from './drop-calendar';
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A drop shaped for the calendar files and the Google Calendar link. */
export function toCalendarDrop(d: DropListItem): CalendarDrop {
  const name = `${d.sneaker.brand} ${d.sneaker.model}${d.sneaker.colorway && d.sneaker.colorway !== 'Default' ? ` ${d.sneaker.colorway}` : ''}`.trim();
  const price = d.retailPriceInr
    ? `${d.fxRate ? 'about ' : ''}₹${d.retailPriceInr.toLocaleString('en-IN')}${d.fxRate ? ` (listed ${d.currency} ${Number(d.retailPrice).toLocaleString('en-US')})` : ''}`
    : 'price TBA';
  return {
    id: d.id,
    title: name,
    date: d.releaseDate,
    time: d.releaseTime,
    timezone: d.releaseTimezone,
    level: d.confirmation === 'confirmed' ? 'Confirmed' : d.confirmation === 'reported' ? 'Reported' : 'Unconfirmed',
    price,
    regions: d.regions.join(', '),
    source: d.sourceName,
    url: d.sourceUrl,
  };
}

/** Read-only, public — a drop's own status/detail is not sensitive. */
@Controller('drops')
export class DropsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly drops: DropsService,
  ) {}

  /** The calendar/list view. `from`/`to` are `YYYY-MM-DD`; `status` is a comma-separated subset of upcoming/live/sold_out. All optional. */
  @Get()
  async list(@Query() query: ListDropsQueryDto): Promise<DropListItem[]> {
    return this.drops.list({ from: query.from, to: query.to, statuses: query.status });
  }

  /** Every drop as an iCalendar file (Google / Apple / Outlook). Date-only drops are all-day events; the summary says how firm the date is. */
  @Get('calendar.ics')
  async calendar(@Res() res: Response): Promise<void> {
    const list = await this.drops.list({});
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chosn-drops.ics"');
    res.send(buildIcs(list.map(toCalendarDrop)));
  }

  /**
   * A personal calendar that keeps itself up to date: the drops one shopper follows or set a reminder for (their anonymous watch id is the
   * secret in the link), plus every upcoming drop of the brands and collabs they follow. Subscribe to it from any calendar app.
   */
  @Get('my.ics')
  async mine(@Query('watch') watch: string, @Res() res: Response): Promise<void> {
    if (!UUID.test(watch ?? '')) throw new BadRequestException('A valid watch id is needed.');
    const ids = await this.drops.followedDropIds(watch);
    const list = await this.drops.list({ ids });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="my-chosn-drops.ics"');
    res.send(buildIcs(list.map(toCalendarDrop), 'My CHOSN drops'));
  }

  /** Indian homegrown brands: their newest public products, and any pre-order or coming-soon item (scripts/scan_brand_sites.py). */
  @Get('india-watch')
  async indiaWatch() {
    const { rows } = await this.db.execute(sql`
      SELECT brand, product_id, title, url, price_inr, image_url, published_at, available, kind, first_seen::text AS first_seen
        FROM (SELECT *, row_number() OVER (PARTITION BY brand ORDER BY (kind <> 'product') DESC, published_at DESC NULLS LAST) AS rn FROM brand_watch_products) t
       WHERE rn <= 4 ORDER BY brand, rn`);
    const byBrand = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows as Array<Record<string, unknown>>) {
      const b = String(r.brand);
      byBrand.set(b, [
        ...(byBrand.get(b) ?? []),
        {
          title: r.title,
          url: r.url,
          priceInr: r.price_inr != null ? Number(r.price_inr) : null,
          imageUrl: r.image_url ?? null,
          publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
          available: Boolean(r.available),
          kind: r.kind,
        },
      ]);
    }
    const { rows: scanned } = await this.db.execute(sql`SELECT max(last_seen)::text AS d FROM brand_watch_products`);
    return { checked: (scanned[0] as { d: string | null } | undefined)?.d ?? null, brands: [...byBrand.entries()].map(([brand, products]) => ({ brand, products })) };
  }

  @Get('by-style-code/:styleCode')
  async byStyleCode(@Param('styleCode') styleCode: string): Promise<DropEventSummary | null> {
    const { rows } = await this.db.execute(sql`
      SELECT de.id, de.status, de.release_date, de.release_time, de.release_timezone,
             de.regions, de.retail_price, de.currency, de.purchase_links, de.raffle_info
      FROM drop_events de
      JOIN sneakers s ON s.id = de.sneaker_id
      WHERE s.style_code = ${styleCode} AND NOT de.hidden ${showDemo() ? sql`` : sql`AND NOT de.is_demo`}
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

  /** One drop as a calendar file, and the matching "add to Google Calendar" link. */
  @Get(':id/calendar.ics')
  async one(@Param('id') id: string, @Res() res: Response): Promise<void> {
    if (!isUUID(id)) throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    const [d] = await this.drops.list({ ids: [id] });
    if (!d) throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chosn-drop-${id.slice(0, 8)}.ics"`);
    res.send(buildIcs([toCalendarDrop(d)], 'CHOSN drop'));
  }

  @Get(':id/google-calendar')
  async google(@Param('id') id: string): Promise<{ url: string }> {
    if (!isUUID(id)) throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    const [d] = await this.drops.list({ ids: [id] });
    if (!d) throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    return { url: googleCalendarUrl(toCalendarDrop(d)) };
  }

  /** The drop-detail page: sneaker info, official links, story, whether it is in Indian stores, a price estimate, and related news. */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<DropDetail> {
    // A non-UUID id would otherwise reach the database as a raw "invalid input syntax for type uuid" 500; it 404s cleanly instead.
    if (!isUUID(id)) {
      throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    }
    const drop = await this.drops.getById(id);
    if (!drop) throw new NotFoundException({ error: 'not_found', message: 'No drop with that id.' });
    return drop;
  }
}
