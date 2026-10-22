import { BadRequestException, Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

/**
 * Anonymous shopper signals for the comparison page: a "view" of a shoe and a "click" on a store's Buy button. Nothing personal is read
 * or stored (see 0035_offer_events.sql). Validated hard, rate-limited per address, and bots are ignored, because anyone can post here.
 */
const SORTS = new Set(['value', 'price', 'fastest']);
const STYLE = /^[A-Za-z0-9._-]{3,40}$/;
const SLUG = /^[a-z0-9-]{2,40}$/;
const VISITOR = /^[A-Za-z0-9-]{8,64}$/;
const BOT = /bot|crawl|spider|slurp|headless|preview|monitor/i;
const hits = new Map<string, { n: number; reset: number }>();

interface EventBody {
  event?: unknown;
  styleCode?: unknown;
  size?: unknown;
  store?: unknown;
  price?: unknown;
  position?: unknown;
  sort?: unknown;
  visitorId?: unknown;
}

@Controller('events')
export class EventsController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Post()
  @HttpCode(204)
  async record(@Body() b: EventBody, @Req() req: Request): Promise<void> {
    if (BOT.test(String(req.headers['user-agent'] ?? ''))) return; // quietly ignored
    const ip = String(req.ip ?? req.socket.remoteAddress ?? 'x');
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now > h.reset) hits.set(ip, { n: 1, reset: now + 60_000 });
    else if (++h.n > 120) return; // over the per-minute limit: drop, do not error
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);

    const event = b.event === 'view' || b.event === 'click' ? b.event : null;
    const style = typeof b.styleCode === 'string' && STYLE.test(b.styleCode) ? b.styleCode : null;
    if (!event || !style) throw new BadRequestException('event must be "view" or "click" with a styleCode');
    const size = typeof b.size === 'number' && b.size >= 1 && b.size <= 20 ? b.size : null;
    const store = typeof b.store === 'string' && SLUG.test(b.store) ? b.store : null;
    if (event === 'click' && !store) throw new BadRequestException('a click needs a store');
    const price = typeof b.price === 'number' && b.price >= 0 && b.price <= 5_000_000 ? Math.round(b.price) : null;
    const position = typeof b.position === 'number' && b.position >= 0 && b.position <= 60 ? Math.round(b.position) : null;
    const sort = typeof b.sort === 'string' && SORTS.has(b.sort) ? b.sort : null;
    const visitor = typeof b.visitorId === 'string' && VISITOR.test(b.visitorId) ? b.visitorId : null;

    // Only real shoes (and, for a click, real stores) are stored, so junk cannot fill the table.
    await this.db.execute(sql`
      INSERT INTO offer_events (event, style_code, size, retailer_slug, price, position, sort_mode, visitor_id)
      SELECT ${event}, s.style_code, ${size}, ${store}, ${price}, ${position}, ${sort}, ${visitor}
      FROM sneakers s
      WHERE s.style_code = ${style} AND (${store}::text IS NULL OR EXISTS (SELECT 1 FROM retailers r WHERE r.slug = ${store}))
    `);
  }
}
