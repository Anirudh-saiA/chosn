import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Put } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { DropsService, type DropListItem } from './drops.service';

/**
 * A shopper's drop follows and reminders ("Notify me"), kept against their anonymous watch id (the same one the wishlist alerts use).
 * The watch id is the only credential, so it is a random UUID. Reminders are sent by DropReminderService.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEADS = new Set([1440, 60, 15]);
const KINDS = new Set(['drop', 'brand', 'collab']);

type Payload = Record<string, unknown>;

@Controller('watch/:id/drops')
export class DropWatchController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly drops: DropsService,
  ) {}

  private async watch(id: string): Promise<void> {
    if (!UUID.test(id)) throw new BadRequestException('bad id');
    const { rows } = await this.db.execute(sql`SELECT 1 FROM watches WHERE id = ${id}`);
    if (rows.length === 0) throw new NotFoundException();
  }

  /** What this shopper follows, their reminders, and the drops those lead to (soonest first). */
  @Get()
  async mine(@Param('id') id: string): Promise<{ follows: Array<{ kind: string; ref: string; size: number | null }>; reminders: Array<{ dropId: string; minutes: number[] }>; drops: DropListItem[] }> {
    await this.watch(id);
    const [{ rows: follows }, { rows: reminders }, ids] = await Promise.all([
      this.db.execute(sql`SELECT kind, ref, size FROM drop_follows WHERE watch_id = ${id}::uuid ORDER BY created_at DESC`),
      this.db.execute(sql`SELECT drop_id, array_agg(minutes_before ORDER BY minutes_before DESC) AS minutes FROM drop_reminders WHERE watch_id = ${id}::uuid GROUP BY drop_id`),
      this.drops.followedDropIds(id),
    ]);
    const list = await this.drops.list({ ids });
    return {
      follows: (follows as Array<{ kind: string; ref: string; size: string | null }>).map((f) => ({ kind: f.kind, ref: f.ref, size: f.size === null ? null : Number(f.size) })),
      reminders: (reminders as Array<{ drop_id: string; minutes: number[] | string }>).map((r) => ({
        dropId: r.drop_id,
        minutes: Array.isArray(r.minutes) ? r.minutes.map(Number) : String(r.minutes).replace(/[{}]/g, '').split(',').map(Number),
      })),
      drops: list,
    };
  }

  /** Follow or unfollow a drop, a brand or a collab. A followed drop can carry the shopper's size, for the "your size just landed" alert. */
  @Put('follow')
  @HttpCode(204)
  async follow(@Param('id') id: string, @Body() b: Payload): Promise<void> {
    await this.watch(id);
    const kind = typeof b.kind === 'string' && KINDS.has(b.kind) ? b.kind : null;
    const ref = typeof b.ref === 'string' ? b.ref.trim().slice(0, 120) : '';
    if (!kind || !ref) throw new BadRequestException('kind and ref are needed');
    if (kind === 'drop' && !UUID.test(ref)) throw new BadRequestException('a drop is followed by its id');
    const size = typeof b.size === 'number' && b.size >= 1 && b.size <= 20 ? b.size : null;
    const count = await this.db.execute(sql`SELECT count(*)::int AS n FROM drop_follows WHERE watch_id = ${id}::uuid`);
    if (b.on === false) {
      await this.db.execute(sql`DELETE FROM drop_follows WHERE watch_id = ${id}::uuid AND kind = ${kind} AND ref = ${ref}`);
      return;
    }
    if (Number((count.rows[0] as { n: number }).n) >= 200) throw new BadRequestException('That is a lot of follows; unfollow some first.');
    await this.db.execute(sql`
      INSERT INTO drop_follows (watch_id, kind, ref, size) VALUES (${id}::uuid, ${kind}, ${ref}, ${size})
      ON CONFLICT (watch_id, kind, ref) DO UPDATE SET size = COALESCE(EXCLUDED.size, drop_follows.size)`);
  }

  /** "Notify me": set which lead times (1 day, 1 hour, 15 minutes) this shopper wants for a drop. An empty list turns reminders off. */
  @Put('reminders')
  @HttpCode(204)
  async reminders(@Param('id') id: string, @Body() b: Payload): Promise<void> {
    await this.watch(id);
    const dropId = typeof b.dropId === 'string' && UUID.test(b.dropId) ? b.dropId : null;
    if (!dropId) throw new BadRequestException('dropId is needed');
    const minutes = [...new Set((Array.isArray(b.minutes) ? b.minutes : []).map(Number).filter((m) => LEADS.has(m)))];
    const found = await this.db.execute(sql`SELECT 1 FROM drop_events WHERE id = ${dropId}::uuid AND NOT hidden`);
    if (found.rows.length === 0) throw new NotFoundException('No such drop');
    await this.db.execute(sql`DELETE FROM drop_reminders WHERE watch_id = ${id}::uuid AND drop_id = ${dropId}::uuid`);
    for (const m of minutes) {
      await this.db.execute(sql`INSERT INTO drop_reminders (watch_id, drop_id, minutes_before) VALUES (${id}::uuid, ${dropId}::uuid, ${m}) ON CONFLICT DO NOTHING`);
    }
    if (minutes.length > 0) {
      const size = typeof b.size === 'number' && b.size >= 1 && b.size <= 20 ? b.size : null;
      await this.db.execute(sql`
        INSERT INTO drop_follows (watch_id, kind, ref, size) VALUES (${id}::uuid, 'drop', ${dropId}, ${size})
        ON CONFLICT (watch_id, kind, ref) DO UPDATE SET size = COALESCE(EXCLUDED.size, drop_follows.size)`);
    }
  }
}
