import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

/**
 * "How did it go?" answers from shoppers who bought a shoe at a store they found through CHOSN (see 0036_order_feedback.sql). Anonymous.
 * Validated hard, rate-limited per address, with a honeypot field, because anyone can post here and a store's score depends on it.
 */
const PROBLEMS = new Set(['late', 'wrong_item', 'damaged', 'suspected_fake', 'refund_issue', 'poor_support']);
const REASONS = new Set(['price_changed', 'out_of_stock', 'found_elsewhere', 'changed_mind', 'other']);
const STYLE = /^[A-Za-z0-9._-]{3,40}$/;
const SLUG = /^[a-z0-9-]{2,40}$/;
const VISITOR = /^[A-Za-z0-9-]{8,64}$/;
const hits = new Map<string, { n: number; reset: number }>();

interface FeedbackBody {
  styleCode?: unknown;
  size?: unknown;
  store?: unknown;
  bought?: unknown;
  notBoughtReason?: unknown;
  orderedOn?: unknown;
  deliveredInDays?: unknown;
  promisedMaxDays?: unknown;
  asDescribed?: unknown;
  sizeOk?: unknown;
  problems?: unknown;
  wouldBuyAgain?: unknown;
  comment?: unknown;
  visitorId?: unknown;
  website?: unknown; // honeypot: a real person never fills this
}

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null);
const intIn = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : null);

@Controller('order-feedback')
export class OrderFeedbackController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Post()
  @HttpCode(204)
  async submit(@Body() b: FeedbackBody, @Req() req: Request): Promise<void> {
    if (typeof b.website === 'string' && b.website.length > 0) return; // honeypot filled: a bot, quietly ignored
    const ip = String(req.ip ?? req.socket.remoteAddress ?? 'x');
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now > h.reset) hits.set(ip, { n: 1, reset: now + 3_600_000 });
    else if (++h.n > 12) throw new BadRequestException('Too many answers from this address for now. Please try again later.');
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);

    const style = typeof b.styleCode === 'string' && STYLE.test(b.styleCode) ? b.styleCode : null;
    const store = typeof b.store === 'string' && SLUG.test(b.store) ? b.store : null;
    const bought = oneOf(b.bought, ['yes', 'no', 'later'] as const);
    if (!style || !store || !bought) throw new BadRequestException('A shoe, a store and whether you bought it are needed.');

    const size = typeof b.size === 'number' && b.size >= 1 && b.size <= 20 ? b.size : null;
    const reason = bought === 'yes' ? null : oneOf(b.notBoughtReason, [...REASONS] as const);
    const orderedOn = typeof b.orderedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.orderedOn) ? b.orderedOn : null;
    const delivered = bought === 'yes' ? intIn(b.deliveredInDays, 0, 120) : null;
    const promised = intIn(b.promisedMaxDays, 0, 120);
    // On time = it arrived within the store's own stated maximum, with one day of grace. Unknown until it has arrived.
    const onTime = delivered !== null && promised !== null ? delivered <= promised + 1 : null;
    const asDescribed = bought === 'yes' ? oneOf(b.asDescribed, ['yes', 'no', 'unsure'] as const) : null;
    const sizeOk = bought === 'yes' ? oneOf(b.sizeOk, ['yes', 'no', 'exchanged'] as const) : null;
    const problems = bought === 'yes' && Array.isArray(b.problems) ? [...new Set(b.problems.filter((p): p is string => typeof p === 'string' && PROBLEMS.has(p)))] : [];
    const again = bought === 'yes' && typeof b.wouldBuyAgain === 'boolean' ? b.wouldBuyAgain : null;
    const comment = typeof b.comment === 'string' ? b.comment.replace(/\s+/g, ' ').trim().slice(0, 280) || null : null;
    const visitor = typeof b.visitorId === 'string' && VISITOR.test(b.visitorId) ? b.visitorId : null;

    const { rows } = await this.db.execute(sql`
      INSERT INTO order_feedback (style_code, size, retailer_slug, bought, not_bought_reason, ordered_on, delivered_in_days, promised_max_days,
                                  arrived_on_time, as_described, size_ok, problems, would_buy_again, comment, visitor_id)
      SELECT s.style_code, ${size}, r.slug, ${bought}, ${reason}, ${orderedOn}::date, ${delivered}, ${promised}, ${onTime}, ${asDescribed}, ${sizeOk},
             ${sql`ARRAY[${problems.length ? sql.join(problems.map((p) => sql`${p}`), sql`, `) : sql``}]::text[]`}, ${again}, ${comment}, ${visitor}
      FROM sneakers s CROSS JOIN retailers r
      WHERE s.style_code = ${style} AND r.slug = ${store}
      RETURNING id
    `);
    if (rows.length === 0) throw new BadRequestException('That shoe or store was not found.');
  }

  /** The answers so far for one store, as counts (nothing individual). Used by the Trust score and the store row. */
  @Get(':store/summary')
  async summary(@Param('store') store: string) {
    if (!SLUG.test(store)) throw new BadRequestException('bad store');
    const { rows } = await this.db.execute(sql`
      SELECT count(*) FILTER (WHERE bought = 'yes') AS bought,
             count(*) FILTER (WHERE bought = 'yes' AND arrived_on_time IS NOT NULL) AS delivered,
             count(*) FILTER (WHERE arrived_on_time) AS on_time,
             count(*) FILTER (WHERE bought = 'yes' AND as_described IN ('yes', 'no')) AS described_answers,
             count(*) FILTER (WHERE as_described = 'yes') AS as_described,
             count(*) FILTER (WHERE bought = 'yes' AND would_buy_again IS NOT NULL) AS again_answers,
             count(*) FILTER (WHERE would_buy_again) AS would_buy_again,
             count(*) FILTER (WHERE 'suspected_fake' = ANY(problems)) AS suspected_fake
      FROM order_feedback WHERE retailer_slug = ${store}
    `);
    const r = (rows[0] ?? {}) as Record<string, string>;
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)]));
  }
}
