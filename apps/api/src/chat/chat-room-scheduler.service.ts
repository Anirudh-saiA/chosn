import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Queue, Worker } from 'bullmq';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { bullConnection } from '../queue/queue.config';

const CHAT_ROOM_SCHEDULER_QUEUE = 'chat-room-scheduler';

interface OpenedRow {
  id: string;
  dropEventId: string;
}

/**
 * Task 5's auto-create/auto-archive, built as the same recurring-BullMQ-
 * job shape DropSchedulerService already established (Day 13) — one more
 * poller reusing a proven pattern rather than a second scheduling
 * mechanism to reason about. Genuinely simplified from the schema's own
 * 'scheduled' status, flagged here rather than left silently unused: a
 * room is created *already* 'open' at the moment its 1h-before-release
 * window arrives, not pre-created earlier in a 'scheduled' state and
 * flipped open later — the brief's "auto-create... when the window
 * approaches" reads as one event (create = open), not two. 'scheduled'
 * stays in the enum for a real future case (e.g. showing "chat opens in
 * 40m" before it's live) without a schema change, but nothing sets it
 * today.
 */
@Injectable()
export class ChatRoomSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatRoomSchedulerService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — chat room scheduler not started');
      return;
    }

    const connection = bullConnection();
    this.queue = new Queue(CHAT_ROOM_SCHEDULER_QUEUE, { connection });
    this.worker = new Worker(CHAT_ROOM_SCHEDULER_QUEUE, () => this.tick(), { connection, concurrency: 1 });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`chat room scheduler tick failed: ${err.message}`);
      Sentry.captureException(err, { tags: { component: 'chat-room-scheduler' } });
    });

    // Same escape hatch convention as DROP_SCHEDULER_SCHEDULE/PRICE_FETCH_SCHEDULE.
    if (process.env.CHAT_ROOM_SCHEDULER_SCHEDULE !== 'off') {
      const minutes = Number(process.env.CHAT_ROOM_SCHEDULER_INTERVAL_MINUTES || 1);
      await this.queue.upsertJobScheduler(
        'chat-room-scheduler-recurring',
        { every: minutes * 60_000 },
        { name: 'chat-room-scheduler-tick' },
      );
      this.logger.log(`chat room scheduler ready, polling every ${minutes}m`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Public (like DropSchedulerService.tick) so the local verification script can invoke a cycle directly rather than waiting on BullMQ's timer. */
  async tick(): Promise<{ opened: number; archived: number }> {
    const opened = await this.openDueRooms();
    const archived = await this.archiveDueRooms();
    return { opened: opened.length, archived };
  }

  /**
   * Creates a room the instant a drop's window arrives — the `NOT
   * EXISTS` guard is this method's idempotency check, same shape as
   * DropSchedulerService.flipDueDrops' `status = 'upcoming'` guard: a
   * drop_event with a room already can't get a second one (chat_rooms'
   * own unique index on drop_event_id would reject it anyway; this
   * avoids even attempting the insert every subsequent tick).
   * release_time IS NOT NULL is the same TBA-release exclusion
   * DropSchedulerService applies — nothing to compare against `now()`
   * for a drop whose hour isn't set yet.
   */
  private async openDueRooms(): Promise<OpenedRow[]> {
    try {
      const result = await this.db.execute(sql`
        INSERT INTO chat_rooms (drop_event_id, status, opens_at, archives_at)
        SELECT
          de.id,
          'open',
          ((de.release_date + de.release_time) AT TIME ZONE de.release_timezone) - interval '1 hour',
          ((de.release_date + de.release_time) AT TIME ZONE de.release_timezone) + interval '24 hours'
        FROM drop_events de
        WHERE de.release_time IS NOT NULL
          AND de.status IN ('upcoming', 'live')
          AND ((de.release_date + de.release_time) AT TIME ZONE de.release_timezone) - interval '1 hour' <= now()
          AND NOT EXISTS (SELECT 1 FROM chat_rooms cr WHERE cr.drop_event_id = de.id)
        RETURNING id, drop_event_id
      `);
      const rows = (result.rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        dropEventId: String(r.drop_event_id),
      }));
      for (const room of rows) {
        this.logger.log(`chat room opened for drop ${room.dropEventId}`);
      }
      return rows;
    } catch (err) {
      this.logger.error(`chat room open query failed: ${(err as Error).message}`);
      Sentry.captureException(err, { tags: { component: 'chat-room-scheduler-open' } });
      return [];
    }
  }

  private async archiveDueRooms(): Promise<number> {
    try {
      const result = await this.db.execute(sql`
        UPDATE chat_rooms SET status = 'archived'
        WHERE status = 'open' AND archives_at IS NOT NULL AND archives_at <= now()
        RETURNING id, drop_event_id
      `);
      const rows = result.rows as Record<string, unknown>[];
      for (const r of rows) {
        this.logger.log(`chat room archived for drop ${String(r.drop_event_id)}`);
      }
      return rows.length;
    } catch (err) {
      this.logger.error(`chat room archive query failed: ${(err as Error).message}`);
      Sentry.captureException(err, { tags: { component: 'chat-room-scheduler-archive' } });
      return 0;
    }
  }
}
