import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';
import { sql } from 'drizzle-orm';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

/**
 * The admin screen's API for drops: list everything (hidden and demo too), add, edit, hide (not approved) or delete a drop, with its
 * source, how firm the date is, its picture and its story. Staff only (ApiAuthGuard then AdminGuard, in that order).
 * Every field is checked here; nothing is trusted from the browser.
 */
const REGIONS = new Set(['india', 'us', 'global']);
const LEVELS = new Set(['confirmed', 'reported', 'unconfirmed']);
const INDIA = new Set(['unknown', 'confirmed_india', 'global_only']);
const STATUSES = new Set(['upcoming', 'live', 'sold_out']);
const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s]{4,}$/.test(u);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Payload = Record<string, unknown>;

function zoneOk(z: unknown): z is string {
  if (typeof z !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

/** Turns a request body into checked column values; `partial` skips fields that were not sent (for edits). */
export function check(b: Payload, partial: boolean): { drop: Record<string, unknown>; sneaker: Record<string, unknown> } {
  const drop: Record<string, unknown> = {};
  const sneaker: Record<string, unknown> = {};
  const has = (k: string) => b[k] !== undefined;
  const need = (k: string) => {
    if (!partial && !has(k)) throw new BadRequestException(`${k} is required`);
  };

  need('releaseDate');
  if (has('releaseDate')) {
    if (typeof b.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.releaseDate) || Number.isNaN(Date.parse(b.releaseDate))) throw new BadRequestException('releaseDate must be YYYY-MM-DD');
    drop.release_date = b.releaseDate;
  }
  if (has('releaseTime')) {
    if (b.releaseTime === null || b.releaseTime === '') drop.release_time = null;
    else if (typeof b.releaseTime === 'string' && /^\d{2}:\d{2}$/.test(b.releaseTime) && Number(b.releaseTime.slice(0, 2)) < 24 && Number(b.releaseTime.slice(3)) < 60) drop.release_time = b.releaseTime;
    else throw new BadRequestException('releaseTime must be HH:MM');
  }
  if (has('timezone')) {
    if (!zoneOk(b.timezone)) throw new BadRequestException('timezone must be an IANA zone such as Asia/Kolkata');
    drop.release_timezone = b.timezone;
  }
  if (has('retailPrice')) {
    if (b.retailPrice === null || b.retailPrice === '') drop.retail_price = null;
    else if (typeof b.retailPrice === 'number' && b.retailPrice > 0 && b.retailPrice < 10_000_000) drop.retail_price = b.retailPrice;
    else throw new BadRequestException('retailPrice must be a positive number');
  }
  if (has('currency')) {
    if (typeof b.currency !== 'string' || !/^[A-Z]{3}$/.test(b.currency)) throw new BadRequestException('currency must be a 3-letter code such as INR');
    drop.currency = b.currency;
  }
  if (has('regions')) {
    if (!Array.isArray(b.regions) || b.regions.some((r) => !REGIONS.has(String(r)))) throw new BadRequestException('regions must be india, us or global');
    drop.regions = b.regions;
  }
  if (has('status')) {
    if (!STATUSES.has(String(b.status))) throw new BadRequestException('status must be upcoming, live or sold_out');
    drop.status = b.status;
  }
  if (has('confirmation')) {
    if (!LEVELS.has(String(b.confirmation))) throw new BadRequestException('confirmation must be confirmed, reported or unconfirmed');
    drop.confirmation = b.confirmation;
  }
  if (has('indiaStatus')) {
    if (!INDIA.has(String(b.indiaStatus))) throw new BadRequestException('indiaStatus must be unknown, confirmed_india or global_only');
    drop.india_status = b.indiaStatus;
  }
  if (has('hidden')) drop.hidden = b.hidden === true;
  if (has('story')) drop.story = str(b.story, 4000);
  if (has('sourceName') || !partial) {
    const n = str(b.sourceName, 120);
    if (!n && !partial) throw new BadRequestException('sourceName is required: who confirmed this drop');
    if (n || has('sourceName')) drop.source_name = n;
  }
  if (has('sourceUrl') || !partial) {
    if (b.sourceUrl !== undefined && b.sourceUrl !== null && b.sourceUrl !== '' && !https(b.sourceUrl)) throw new BadRequestException('sourceUrl must be an https link');
    if (!partial && !https(b.sourceUrl)) throw new BadRequestException('sourceUrl is required (an https link)');
    if (has('sourceUrl')) drop.source_url = b.sourceUrl || null;
  }
  if (has('links')) {
    const links = Array.isArray(b.links) ? b.links : [];
    drop.purchase_links = JSON.stringify(links.filter((l): l is { label: string; url: string } => typeof l === 'object' && l !== null && typeof (l as Payload).label === 'string' && https((l as Payload).url)).slice(0, 10).map((l) => ({ label: l.label.slice(0, 80), url: l.url })));
  }
  if (has('raffle')) drop.raffle_info = b.raffle && typeof b.raffle === 'object' ? JSON.stringify(b.raffle) : null;

  for (const [k, col, max] of [['brand', 'brand', 80], ['model', 'model', 160], ['colorway', 'colorway', 120]] as const) {
    if (has(k)) {
      const v = str(b[k], max);
      if (!v) throw new BadRequestException(`${k} cannot be empty`);
      sneaker[col] = v;
    } else if (!partial && k !== 'colorway') need(k);
  }
  if (has('imageUrl')) {
    if (b.imageUrl && !https(b.imageUrl)) throw new BadRequestException('imageUrl must be an https link');
    sneaker.primary_image_url = b.imageUrl || null;
  }
  if (has('imageCredit')) sneaker.image_credit = str(b.imageCredit, 160);
  return { drop, sneaker };
}

@Controller('admin/drops')
@UseGuards(ApiAuthGuard, AdminGuard)
export class AdminDropsController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Get()
  async list(@Query('q') q?: string) {
    const term = typeof q === 'string' && q.trim() ? `%${q.trim().toLowerCase().slice(0, 60)}%` : null;
    const { rows } = await this.db.execute(sql`
      SELECT de.id, de.release_date::text AS release_date, de.release_time::text AS release_time, de.release_timezone, de.status, de.confirmation, de.india_status,
             de.hidden, de.is_demo, de.retail_price, de.currency, de.source_name, de.source_url, de.regions,
             s.style_code, s.brand, s.model, s.colorway, s.primary_image_url
        FROM drop_events de JOIN sneakers s ON s.id = de.sneaker_id
       ${term ? sql`WHERE lower(s.brand || ' ' || s.model || ' ' || s.colorway || ' ' || s.style_code) LIKE ${term}` : sql``}
       ORDER BY de.release_date DESC, s.brand LIMIT 500`);
    return { drops: rows };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    if (!isUUID(id)) throw new NotFoundException();
    const { rows } = await this.db.execute(sql`
      SELECT de.id, de.release_date::text AS release_date, de.release_time::text AS release_time, de.release_timezone, de.status, de.confirmation, de.india_status,
             de.hidden, de.is_demo, de.retail_price, de.currency, de.source_name, de.source_url, de.regions, de.story, de.purchase_links, de.raffle_info,
             s.style_code, s.brand, s.model, s.colorway, s.primary_image_url, s.image_credit
        FROM drop_events de JOIN sneakers s ON s.id = de.sneaker_id WHERE de.id = ${id}`);
    if (!rows[0]) throw new NotFoundException();
    return rows[0];
  }

  @Post()
  async create(@Body() b: Payload) {
    const { drop, sneaker } = check(b, false);
    let styleCode = str(b.styleCode, 40);
    if (styleCode && !/^[A-Za-z0-9._-]{3,40}$/.test(styleCode)) throw new BadRequestException('styleCode may only have letters, digits, . _ -');
    let shoe = styleCode ? await this.db.execute(sql`SELECT id FROM sneakers WHERE style_code = ${styleCode}`) : null;
    if (!shoe || shoe.rows.length === 0) {
      if (!sneaker.brand || !sneaker.model) throw new BadRequestException('brand and model are needed for a shoe we do not track yet');
      styleCode ??= `DROP-${slug(`${sneaker.brand}-${sneaker.model}-${sneaker.colorway ?? ''}`).slice(0, 28)}-${createHash('sha1').update(`${sneaker.brand}|${sneaker.model}|${sneaker.colorway ?? ''}|${drop.release_date}`).digest('hex').slice(0, 6)}`;
      shoe = await this.db.execute(sql`
        INSERT INTO sneakers (brand, model, colorway, style_code, currency, retail_price, release_date, primary_image_url, image_credit)
        VALUES (${sneaker.brand as string}, ${sneaker.model as string}, ${(sneaker.colorway as string) ?? 'Default'}, ${styleCode}, ${(drop.currency as string) ?? 'INR'}, ${(drop.retail_price as number) ?? null}, ${drop.release_date as string}::date,
                ${(sneaker.primary_image_url as string) ?? null}, ${(sneaker.image_credit as string) ?? null})
        ON CONFLICT (style_code) DO UPDATE SET updated_at = now() RETURNING id`);
    }
    const sneakerId = (shoe.rows[0] as { id: string }).id;
    const { rows } = await this.db.execute(sql`
      INSERT INTO drop_events (sneaker_id, release_date, release_time, release_timezone, retail_price, currency, regions, status, confirmation, india_status, hidden,
                               story, source_name, source_url, purchase_links, raffle_info, is_demo)
      VALUES (${sneakerId}, ${drop.release_date as string}::date, ${(drop.release_time as string) ?? null}::time, ${(drop.release_timezone as string) ?? 'Asia/Kolkata'},
              ${(drop.retail_price as number) ?? null}, ${(drop.currency as string) ?? 'INR'}, ${sql.raw(`'{${((drop.regions as string[]) ?? ['india']).join(',')}}'::region[]`)},
              ${(drop.status as string) ?? 'upcoming'}::drop_status, ${(drop.confirmation as string) ?? 'confirmed'}, ${(drop.india_status as string) ?? 'unknown'}, ${(drop.hidden as boolean) ?? false},
              ${(drop.story as string) ?? null}, ${drop.source_name as string}, ${drop.source_url as string}, ${(drop.purchase_links as string) ?? '[]'}::jsonb, ${(drop.raffle_info as string) ?? null}::jsonb, false)
      RETURNING id`);
    return { id: (rows[0] as { id: string }).id };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() b: Payload) {
    if (!isUUID(id)) throw new NotFoundException();
    const { drop, sneaker } = check(b, true);
    const cur = await this.db.execute(sql`SELECT sneaker_id FROM drop_events WHERE id = ${id}`);
    if (cur.rows.length === 0) throw new NotFoundException();
    const sneakerId = (cur.rows[0] as { sneaker_id: string }).sneaker_id;
    const set: ReturnType<typeof sql>[] = [];
    const cast: Record<string, string> = { release_date: '::date', release_time: '::time', status: '::drop_status', purchase_links: '::jsonb', raffle_info: '::jsonb' };
    for (const [col, val] of Object.entries(drop)) {
      if (col === 'regions') set.push(sql`regions = ${sql.raw(`'{${(val as string[]).join(',')}}'::region[]`)}`);
      else set.push(sql`${sql.raw(col)} = ${val as string | number | boolean | null}${sql.raw(cast[col] ?? '')}`);
    }
    if (set.length) await this.db.execute(sql`UPDATE drop_events SET ${sql.join(set, sql`, `)}, is_demo = false, updated_at = now() WHERE id = ${id}`);
    const sset: ReturnType<typeof sql>[] = [];
    for (const [col, val] of Object.entries(sneaker)) sset.push(sql`${sql.raw(col)} = ${val as string | null}`);
    if (sset.length) await this.db.execute(sql`UPDATE sneakers SET ${sql.join(sset, sql`, `)}, updated_at = now() WHERE id = ${sneakerId}`);
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!isUUID(id)) throw new NotFoundException();
    const r = await this.db.execute(sql`DELETE FROM drop_events WHERE id = ${id} RETURNING id`);
    if (r.rows.length === 0) throw new NotFoundException();
    return { ok: true };
  }
}
