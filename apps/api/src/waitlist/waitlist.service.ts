import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';
import { EmailService } from '../email/email.service';

export type JoinWaitlistResult = { status: 'created' } | { status: 'duplicate' };

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly email: EmailService,
  ) {}

  async join(email: string, interests: string[] = []): Promise<JoinWaitlistResult> {
    const normalizedEmail = email.toLowerCase().trim();

    const result = await this.pool.query(
      `INSERT INTO waitlist_entries (email, interests)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [normalizedEmail, interests],
    );

    if (result.rowCount === 0) {
      return { status: 'duplicate' };
    }

    // Best-effort — a failed confirmation email shouldn't fail a
    // signup that already succeeded.
    this.email.sendWaitlistConfirmation(normalizedEmail).catch((err) => {
      this.logger.warn(`confirmation email failed for ${normalizedEmail}: ${err}`);
    });

    return { status: 'created' };
  }
}
