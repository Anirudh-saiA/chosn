import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';
import { WaitlistDripService } from './waitlist-drip.service';

export type JoinWaitlistResult = { status: 'created' } | { status: 'duplicate' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly drip: WaitlistDripService,
  ) {}

  async join(
    name: string,
    email: string,
    interests: string[] = [],
    shoes: string[] = [],
  ): Promise<JoinWaitlistResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const cleanShoes = shoes.map((s) => s.trim()).filter(Boolean);

    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO waitlist_entries (email, name, interests, tracked_shoes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [normalizedEmail, name.trim(), interests, cleanShoes],
    );

    if (result.rowCount === 0) {
      return { status: 'duplicate' };
    }

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
