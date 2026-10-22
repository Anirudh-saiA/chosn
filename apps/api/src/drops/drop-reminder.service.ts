import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { EmailService } from '../email/email.service';
import { inIndiaTime, reminderDueAt } from './drop-time';

/**
 * The engine behind "Notify me" and follows. Every minute it:
 *   1. sends due reminders (1 day / 1 hour / 15 minutes before a timed drop, or 9:00 IST the day before a date-only one) to the bell and,
 *      when a confirmed e-mail is on file, by mail;
 *   2. tells followers of a brand or collab when a new drop for it is added;
 *   3. tells a follower their size has landed when a followed shoe first shows up in an Indian store in that size;
 *   4. moves drops whose day has passed to Released.
 * Steps 2 to 4 run every 10 minutes. A reminder that is more than 3 hours late (the API was down) is dropped, not sent as news.
 * Opt out locally with DROP_REMINDERS=off.
 */
const WEB = () => (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const API = () => (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const LATE_MS = 3 * 3_600_000;

interface DueRow {
  rid: string;
  watch_id: string;
  minutes_before: number;
  drop_id: string;
  release_date: string;
  release_time: string | null;
  release_timezone: string;
  brand: string;
  model: string;
  colorway: string;
  style_code: string;
  email: string | null;
  email_confirmed: boolean;
  email_instant: boolean;
  unsubscribe_token: string;
}

@Injectable()
export class DropReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DropReminderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private tick = 0;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    if (process.env.DROP_REMINDERS === 'off') return;
    this.timer = setInterval(() => void this.run(), 60_000);
    this.timer.unref();
    setTimeout(() => void this.run(), 20_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendDueReminders();
      if (this.tick++ % 10 === 0) {
        await this.sweepStatuses();
        await this.newDropAlerts();
        await this.sizeLandedAlerts();
      }
    } catch (e) {
      this.logger.warn(`reminder run failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private name(r: { brand: string; model: string; colorway: string }) {
    return `${r.brand} ${r.model}${r.colorway && r.colorway !== 'Default' ? ` ${r.colorway}` : ''}`.trim();
  }

  async sendDueReminders(): Promise<number> {
    const { rows } = await this.db.execute(sql`
      SELECT rm.id AS rid, rm.watch_id, rm.minutes_before, d.id AS drop_id, d.release_date::text AS release_date, d.release_time::text AS release_time, d.release_timezone,
             s.brand, s.model, s.colorway, s.style_code, w.email, w.email_confirmed, w.email_instant, w.unsubscribe_token
        FROM drop_reminders rm
        JOIN drop_events d ON d.id = rm.drop_id AND NOT d.hidden AND d.status <> 'sold_out'
        JOIN sneakers s ON s.id = d.sneaker_id
        JOIN watches w ON w.id = rm.watch_id
       WHERE rm.sent_at IS NULL AND d.release_date BETWEEN current_date - 1 AND current_date + 3`);
    let sent = 0;
    const now = Date.now();
    for (const r of rows as unknown as DueRow[]) {
      const when = { date: r.release_date.slice(0, 10), time: r.release_time, timezone: r.release_timezone };
      const due = reminderDueAt(when, r.minutes_before);
      if (!due || due.getTime() > now) continue;
      if (now - due.getTime() > LATE_MS) {
        await this.db.execute(sql`UPDATE drop_reminders SET sent_at = now() WHERE id = ${r.rid}`); // too late to be useful
        continue;
      }
      const lead = r.minutes_before === 1440 ? 'tomorrow' : r.minutes_before === 60 ? 'in 1 hour' : 'in 15 minutes';
      const message = `${this.name(r)} drops ${lead} (${inIndiaTime(when)}).`;
      await this.db.execute(sql`INSERT INTO watch_alerts (watch_id, style_code, kind, message) VALUES (${r.watch_id}::uuid, ${r.style_code}, 'drop_reminder', ${message})`);
      await this.db.execute(sql`UPDATE drop_reminders SET sent_at = now() WHERE id = ${r.rid}`);
      sent++;
      if (r.email && r.email_confirmed && r.email_instant) {
        const unsub = `${API()}/watch/unsubscribe?token=${r.unsubscribe_token}`;
        const link = `${WEB()}/drops/${r.drop_id}`;
        const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
        void this.email.sendMail(r.email, message.slice(0, 80), `<p><a href="${link}">${esc(message)}</a></p><p style="color:#666;font-size:12px"><a href="${unsub}">Unsubscribe</a> from CHOSN e-mails.</p>`, `${message}\n${link}\nUnsubscribe: ${unsub}`, unsub);
      }
    }
    if (sent > 0) this.logger.log(`${sent} drop reminders sent`);
    return sent;
  }

  /** Date-only drops are Released the day after; timed ones two days after their time; a Live drop likewise. */
  async sweepStatuses(): Promise<void> {
    await this.db.execute(sql`
      UPDATE drop_events SET status = 'sold_out', updated_at = now()
       WHERE status IN ('upcoming', 'live') AND NOT is_demo AND (
             (release_time IS NULL AND release_date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
          OR (release_time IS NOT NULL AND (release_date + release_time) AT TIME ZONE release_timezone < now() - interval '2 days'))`);
  }

  /** A new drop was added for a brand or collab someone follows: one bell alert each. */
  async newDropAlerts(): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO watch_alerts (watch_id, style_code, kind, message)
      SELECT f.watch_id, s.style_code, 'new_drop',
             'New drop for ' || (CASE WHEN f.kind = 'brand' THEN f.ref ELSE f.ref END) || ': ' || s.brand || ' ' || s.model || (CASE WHEN s.colorway <> 'Default' THEN ' ' || s.colorway ELSE '' END) || ' on ' || to_char(d.release_date, 'DD Mon') || '.'
        FROM drop_follows f
        JOIN drop_events d ON d.created_at > f.created_at AND d.created_at > now() - interval '3 days' AND NOT d.hidden AND NOT d.is_demo AND d.status = 'upcoming'
        JOIN sneakers s ON s.id = d.sneaker_id
       WHERE ((f.kind = 'brand' AND s.brand = f.ref) OR (f.kind = 'collab' AND s.model ILIKE '%' || f.ref || '%'))
         AND NOT EXISTS (SELECT 1 FROM watch_alerts a WHERE a.watch_id = f.watch_id AND a.style_code = s.style_code AND a.kind = 'new_drop')`);
  }

  /** A followed drop's shoe now sits in an Indian store in the follower's size. */
  async sizeLandedAlerts(): Promise<void> {
    await this.db.execute(sql`
      WITH hit AS (
        SELECT f.watch_id, f.ref, f.size, s.style_code, s.brand, s.model, s.colorway, v.size AS got,
               r.name AS store, min(effective_price_inr(ps.price, ps.shipping_cost, ps.currency))::int AS price
          FROM drop_follows f
          JOIN drop_events d ON d.id::text = f.ref AND NOT d.hidden
          JOIN sneakers s ON s.id = d.sneaker_id
          JOIN sneaker_variants v ON v.sneaker_id = s.id AND v.size = f.size
          JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'
          JOIN retailers r ON r.id = ps.retailer_id
         WHERE f.kind = 'drop' AND f.size IS NOT NULL AND f.landed_alert_at IS NULL
         GROUP BY f.watch_id, f.ref, f.size, s.style_code, s.brand, s.model, s.colorway, v.size, r.name)
      , pick AS (SELECT DISTINCT ON (watch_id, ref) * FROM hit ORDER BY watch_id, ref, price)
      , ins AS (
        INSERT INTO watch_alerts (watch_id, style_code, size, kind, message, price, store)
        SELECT watch_id, style_code, got, 'size_landed',
               brand || ' ' || model || ' (UK ' || trim(trailing '.' from trim(trailing '0' from got::text)) || ') just landed: from ₹' || to_char(price, 'FM99,99,999') || ' at ' || store || '.', price, store
          FROM pick
        RETURNING 1)
      UPDATE drop_follows f SET landed_alert_at = now()
        FROM pick WHERE f.watch_id = pick.watch_id AND f.kind = 'drop' AND f.ref = pick.ref`);
  }
}
