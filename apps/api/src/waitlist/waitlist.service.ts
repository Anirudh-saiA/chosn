import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';
import { WaitlistDripService } from './waitlist-drip.service';
import { WaitlistSheetService } from './waitlist-sheet.service';

export type JoinWaitlistResult = { status: 'created' } | { status: 'duplicate' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly drip: WaitlistDripService,
    private readonly sheet: WaitlistSheetService,
  ) {}

  async join(
    name: string,
    email: string,
    interests: string[] = [],
    shoes: string[] = [],
    phone?: string,
  ): Promise<JoinWaitlistResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const cleanShoes = shoes.map((s) => s.trim()).filter(Boolean);

    const cleanPhone = phone?.trim() || null;

    const result = await this.pool.query<{ id: string; joined_at: Date; source: string }>(
      `INSERT INTO waitlist_entries (email, name, phone, interests, tracked_shoes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, joined_at, source`,
      [normalizedEmail, name.trim(), cleanPhone, interests, cleanShoes],
    );

    if (result.rowCount === 0) {
      return { status: 'duplicate' };
    }

    // The Excel copy of the waitlist. Best-effort too: a spreadsheet problem never fails a signup.
    void this.sheet.append({
      joinedAt: result.rows[0]!.joined_at,
      name: name.trim(),
      email: normalizedEmail,
      phone: cleanPhone,
      interests,
      shoes: cleanShoes,
      source: result.rows[0]!.source,
      unsubscribed: false,
    });

    // Best-effort — a failed welcome email shouldn't fail a signup that
    // already succeeded; the drip tick retries it.
    this.drip.sendWelcomeFor(result.rows[0]!.id).catch((err) => {
      this.logger.warn(`welcome email failed for ${normalizedEmail}: ${err}`);
    });

    return { status: 'created' };
  }

  async unsubscribe(token: string): Promise<boolean> {
    if (!UUID.test(token)) return false;
    const res = await this.pool.query(
      `UPDATE waitlist_entries SET unsubscribed_at = COALESCE(unsubscribed_at, now())
        WHERE unsubscribe_token = $1`,
      [token],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
