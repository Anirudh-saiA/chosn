import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';
import { EmailService } from '../email/email.service';
import type { WaitlistMailContext } from '../email/waitlist-templates';

type Kind = 'welcome' | 'followup';

interface ClaimedRow {
  id: string;
  email: string;
  name: string | null;
  interests: string[];
  tracked_shoes: string[];
  unsubscribe_token: string;
}

const TICK_MS = 5 * 60_000;
const BATCH = 25;

/**
 * Two-mail waitlist sequence.
 *
 *   mail 1 (welcome)  — right after signup, retried by the tick if the
 *                       inline send failed.
 *   mail 2 (follow-up) — WAITLIST_FOLLOWUP_DELAY_HOURS after joining
 *                       (default 48), personalised by interests + shoes.
 *
 * A row is claimed by stamping its *_sent_at column inside a
 * FOR UPDATE SKIP LOCKED subselect, so overlapping ticks or two API
 * instances can't both send it. A failed send clears the stamp so the
 * next tick retries.
 */
@Injectable()
export class WaitlistDripService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WaitlistDripService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    if (process.env.WAITLIST_DRIP === 'off') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref(); // never hold the process open on its own
    setTimeout(() => void this.tick(), 10_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Inline welcome send for a just-created entry. */
  async sendWelcomeFor(id: string): Promise<void> {
    await this.claimAndSend('welcome', 'id = $1', [id]);
  }

  async tick(): Promise<void> {
    if (this.running || !this.email.enabled) return;
    this.running = true;
    try {
      await this.claimAndSend('welcome', 'TRUE', []);
      const hours = Number(process.env.WAITLIST_FOLLOWUP_DELAY_HOURS ?? 48);
      await this.claimAndSend(
        'followup',
        `welcome_sent_at IS NOT NULL AND joined_at <= now() - ($1 * interval '1 hour')`,
        [Number.isFinite(hours) ? hours : 48],
      );
    } catch (err) {
      this.logger.warn(`drip tick failed: ${err}`);
    } finally {
      this.running = false;
    }
  }

  private async claimAndSend(kind: Kind, where: string, params: unknown[]): Promise<void> {
    if (!this.email.enabled) return;
    const col = kind === 'welcome' ? 'welcome_sent_at' : 'followup_sent_at';

    const { rows } = await this.pool.query<ClaimedRow>(
      `UPDATE waitlist_entries SET ${col} = now()
        WHERE id IN (
          SELECT id FROM waitlist_entries
           WHERE ${col} IS NULL AND unsubscribed_at IS NULL AND (${where})
           ORDER BY joined_at
           LIMIT ${BATCH}
           FOR UPDATE SKIP LOCKED)
        RETURNING id, email, name, interests, tracked_shoes, unsubscribe_token`,
      params,
    );

    for (const row of rows) {
      let sent = false;
      try {
        sent = await this.email.sendWaitlistMail(kind, row.email, this.context(row));
      } catch (err) {
        this.logger.warn(`${kind} email threw for ${row.email}: ${err}`);
      }
      if (!sent) {
        await this.pool.query(`UPDATE waitlist_entries SET ${col} = NULL WHERE id = $1`, [row.id]);
      }
    }
  }

  private context(row: ClaimedRow): WaitlistMailContext {
    const web = (process.env.WEB_URL ?? process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000').trim().replace(/\/$/, '');
    const api = (process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, '');
    return {
      name: row.name ?? '',
      interests: row.interests,
      shoes: row.tracked_shoes,
      webUrl: web,
      instagramUrl: process.env.INSTAGRAM_URL ?? 'https://instagram.com/',
      unsubscribeUrl: `${api}/waitlist/unsubscribe?token=${row.unsubscribe_token}`,
    };
  }
}
