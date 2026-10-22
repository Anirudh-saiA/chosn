import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';
import { appendRow, writeWorkbook, type SheetRow } from './waitlist-sheet';

interface DbRow {
  joined_at: Date;
  name: string | null;
  email: string;
  phone: string | null;
  interests: string[] | null;
  tracked_shoes: string[] | null;
  source: string;
  unsubscribed_at: Date | null;
}

/**
 * Keeps an Excel copy of the waitlist (data/waitlist/waitlist.xlsx, or WAITLIST_XLSX_PATH): one row per signup, added the
 * moment someone joins. The database stays the source of truth: if the file cannot be written (for example it is open in
 * Excel) the next write rebuilds the whole file from the database, so no signup is ever missing from it.
 */
@Injectable()
export class WaitlistSheetService implements OnModuleInit {
  private readonly logger = new Logger(WaitlistSheetService.name);
  readonly path = process.env.WAITLIST_XLSX_PATH ?? resolve(process.cwd(), '../../data/waitlist/waitlist.xlsx');
  private chain: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  onModuleInit() {
    if (!existsSync(this.path)) void this.enqueue(() => this.rebuild());
  }

  /** Called after a signup is saved. Never throws: a spreadsheet problem must not fail a signup. */
  append(row: SheetRow): Promise<void> {
    return this.enqueue(async () => {
      if (this.dirty) return this.rebuild();
      await appendRow(this.path, row);
    });
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(job).catch((err: unknown) => {
      this.dirty = true;
      this.logger.warn(`could not update ${this.path} (${String(err)}); it will be rebuilt on the next signup`);
    });
    return this.chain;
  }

  private async rebuild(): Promise<void> {
    const { rows } = await this.pool.query<DbRow>(
      'SELECT joined_at, name, email, phone, interests, tracked_shoes, source, unsubscribed_at FROM waitlist_entries ORDER BY joined_at',
    );
    await writeWorkbook(
      this.path,
      rows.map((r) => ({
        joinedAt: r.joined_at,
        name: r.name ?? '',
        email: r.email,
        phone: r.phone,
        interests: r.interests ?? [],
        shoes: r.tracked_shoes ?? [],
        source: r.source,
        unsubscribed: r.unsubscribed_at !== null,
      })),
    );
    this.dirty = false;
    this.logger.log(`waitlist Excel rebuilt: ${rows.length} row(s) at ${this.path}`);
  }
}
