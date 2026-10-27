import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, Put, Query, Redirect, UseGuards } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { EmailService } from '../email/email.service';

/**
 * Wishlist alerts (0037_watch_alerts.sql). An anonymous "watch" id lives in the shopper's browser; hearted shoes + sizes are synced here
 * so the nightly job (scripts/send-watch-alerts.ts) can notice a size coming back, a price drop or a reached target, and tell them in the
 * bell inbox and, once they have confirmed an e-mail, by mail. The watch id is the only credential, so it is a random UUID.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STYLE = /^[A-Za-z0-9._-]{3,40}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const web = () => (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const api = () => (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');

interface ItemIn {
  styleCode?: unknown;
  size?: unknown;
  targetPrice?: unknown;
}

function checkId(id: string): string {
  if (!UUID.test(id)) throw new BadRequestException('bad id');
  return id;
}

@Controller('watch')
export class WatchController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly email: EmailService,
  ) {}

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 3600 })
  @Post()
  async create() {
    const { rows } = await this.db.execute(sql`INSERT INTO watches DEFAULT VALUES RETURNING id`);
    return { id: (rows[0] as { id: string }).id };
  }

  /** Replace the watch's shoe list with the one on the device (max 60). Keeps the last-seen state of shoes that stay. */
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 120, windowSeconds: 3600 })
  @Put(':id/items')
  @HttpCode(204)
  async items(@Param('id') id: string, @Body() body: { items?: ItemIn[] }): Promise<void> {
    checkId(id);
    const list = (Array.isArray(body?.items) ? body.items : []).slice(0, 60).flatMap((i) => {
      if (typeof i.styleCode !== 'string' || !STYLE.test(i.styleCode)) return [];
      const size = typeof i.size === 'number' ? i.size : Number(i.size);
      const target = typeof i.targetPrice === 'number' && i.targetPrice > 0 && i.targetPrice < 10_000_000 ? Math.round(i.targetPrice) : null;
      return [{ style: i.styleCode, size: Number.isFinite(size) && size >= 1 && size <= 20 ? size : null, target }];
    });
    const { rows } = await this.db.execute(sql`SELECT 1 FROM watches WHERE id = ${id}`);
    if (rows.length === 0) throw new NotFoundException();
    const styles = sql.join(list.map((i) => sql`${i.style}`), sql`, `);
    if (list.length === 0) await this.db.execute(sql`DELETE FROM watch_items WHERE watch_id = ${id}`);
    else await this.db.execute(sql`DELETE FROM watch_items WHERE watch_id = ${id} AND style_code NOT IN (${styles})`);
    for (const i of list) {
      await this.db.execute(sql`
        INSERT INTO watch_items (watch_id, style_code, size, target_price) VALUES (${id}, ${i.style}, ${i.size}, ${i.target})
        ON CONFLICT (watch_id, style_code) DO UPDATE SET size = EXCLUDED.size, target_price = EXCLUDED.target_price,
          last_in_stock = CASE WHEN watch_items.size IS DISTINCT FROM EXCLUDED.size THEN NULL ELSE watch_items.last_in_stock END,
          last_price = CASE WHEN watch_items.size IS DISTINCT FROM EXCLUDED.size THEN NULL ELSE watch_items.last_price END`);
    }
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowSeconds: 3600 })
  @Get('confirm')
  @Redirect()
  async confirm(@Query('token') token: string) {
    if (typeof token === 'string' && /^[a-f0-9]{20,64}$/.test(token)) {
      await this.db.execute(sql`UPDATE watches SET email_confirmed = true, confirm_token = NULL WHERE confirm_token = ${token}`);
    }
    return { url: `${web()}/notifications?alerts=confirmed` };
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowSeconds: 3600 })
  @Get('unsubscribe')
  @Redirect()
  async unsubscribe(@Query('token') token: string) {
    if (typeof token === 'string' && /^[a-f0-9]{20,64}$/.test(token)) {
      await this.db.execute(sql`UPDATE watches SET email = NULL, email_confirmed = false, confirm_token = NULL WHERE unsubscribe_token = ${token}`);
    }
    return { url: `${web()}/notifications?alerts=unsubscribed` };
  }

  @Get(':id')
  async status(@Param('id') id: string) {
    checkId(id);
    const { rows } = await this.db.execute(sql`
      SELECT email, email_confirmed, email_instant, email_weekly,
             (SELECT count(*) FROM watch_alerts a WHERE a.watch_id = w.id AND a.read_at IS NULL) AS unread
      FROM watches w WHERE id = ${id}`);
    const r = rows[0] as { email: string | null; email_confirmed: boolean; email_instant: boolean; email_weekly: boolean; unread: string } | undefined;
    if (!r) throw new NotFoundException();
    const masked = r.email ? r.email.replace(/^(.).*(@.*)$/, '$1***$2') : null;
    return { email: masked, confirmed: r.email_confirmed, instant: r.email_instant, weekly: r.email_weekly, unread: Number(r.unread) };
  }

  // Per address as well as per IP: many addresses must not be able to mail one inbox. A repeat of the same address is a resend.
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 3600, also: { bodyField: 'email', limit: 3 }, failClosed: true })
  @Post(':id/email')
  @HttpCode(204)
  async setEmail(@Param('id') id: string, @Body() body: { email?: unknown }): Promise<void> {
    checkId(id);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL.test(email)) throw new BadRequestException('Please enter a valid e-mail address.');
    const token = randomBytes(18).toString('hex');
    const { rows } = await this.db.execute(sql`
      UPDATE watches SET email = ${email}, email_confirmed = false, confirm_token = ${token} WHERE id = ${id} RETURNING unsubscribe_token`);
    if (rows.length === 0) throw new NotFoundException();
    const link = `${api()}/watch/confirm?token=${token}`;
    const unsub = `${api()}/watch/unsubscribe?token=${(rows[0] as { unsubscribe_token: string }).unsubscribe_token}`;
    await this.email.sendMail(
      email,
      'Confirm your CHOSN wishlist alerts',
      `<p>Confirm that you want e-mail alerts for the sneakers on your CHOSN wishlist: a size coming back, a price drop, or your target price reached.</p><p><a href="${link}">Yes, send me alerts</a></p><p style="color:#666;font-size:12px">If this was not you, ignore this mail and nothing will be sent. <a href="${unsub}">Unsubscribe</a></p>`,
      `Confirm your CHOSN wishlist alerts: ${link}\nIf this was not you, ignore this mail.`,
      unsub,
    );
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowSeconds: 3600 })
  @Patch(':id/prefs')
  @HttpCode(204)
  async prefs(@Param('id') id: string, @Body() body: { instant?: unknown; weekly?: unknown }): Promise<void> {
    checkId(id);
    const instant = typeof body?.instant === 'boolean' ? body.instant : null;
    const weekly = typeof body?.weekly === 'boolean' ? body.weekly : null;
    await this.db.execute(sql`UPDATE watches SET email_instant = COALESCE(${instant}::boolean, email_instant), email_weekly = COALESCE(${weekly}::boolean, email_weekly) WHERE id = ${id}`);
  }

  @Get(':id/alerts')
  async alerts(@Param('id') id: string) {
    checkId(id);
    const { rows } = await this.db.execute(sql`
      SELECT a.id, a.created_at, a.style_code, a.size, a.kind, a.message, a.price, a.store, a.read_at IS NULL AS unread,
             s.brand, s.model, s.colorway
      FROM watch_alerts a LEFT JOIN sneakers s ON s.style_code = a.style_code
      WHERE a.watch_id = ${id} ORDER BY a.created_at DESC LIMIT 40`);
    return { alerts: rows };
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 120, windowSeconds: 3600 })
  @Post(':id/alerts/read')
  @HttpCode(204)
  async read(@Param('id') id: string): Promise<void> {
    checkId(id);
    await this.db.execute(sql`UPDATE watch_alerts SET read_at = now() WHERE watch_id = ${id} AND read_at IS NULL`);
  }
}
