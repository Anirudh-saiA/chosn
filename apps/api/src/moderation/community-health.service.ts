import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

export interface CommunityHealthSummary {
  /** Last 14 days, grouped by day + post type — the shape of what's actually getting posted. */
  postsPerDay: { day: string; postType: string; count: number }[];
  /** Distinct users who posted, commented, or voted in the last 7 days — "active," not "registered." */
  activeUsers7d: number;
  reports: {
    last7d: number;
    last30d: number;
    byStatus: Record<string, number>;
    /** (reviewed + actioned + dismissed) / total over the last 30 days — how much of the queue isn't just sitting pending. */
    resolutionRatePct: number;
  };
  /**
   * Chat rooms with an unusually high report count in the last 7 days —
   * the early-warning signal task 5 asks for: a room accumulating
   * reports fast, most likely during a hyped drop's live chat, before
   * it becomes a bigger problem.
   */
  highReportRooms: { roomId: string; dropEventId: string; sneakerLabel: string | null; reportCount: number }[];
}

/** Task 5's threshold for "unusually high" — flagged the same way the reputation/vote-manipulation numbers are: a starting point, not a settled answer. 3 message reports against one room within 7 days is enough to be worth a human glance without being so low that ordinary one-off reports trigger it constantly. */
const HIGH_REPORT_ROOM_THRESHOLD = 3;

@Injectable()
export class CommunityHealthService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async summary(): Promise<CommunityHealthSummary> {
    const [postsPerDay, activeUsers7d, reportCounts, highReportRooms] = await Promise.all([
      this.postsPerDay(),
      this.activeUsers7d(),
      this.reportCounts(),
      this.highReportRooms(),
    ]);

    return { postsPerDay, activeUsers7d, reports: reportCounts, highReportRooms };
  }

  private async postsPerDay(): Promise<CommunityHealthSummary['postsPerDay']> {
    const { rows } = await this.db.execute(sql`
      SELECT date_trunc('day', created_at) AS day, post_type, count(*)::int AS count
      FROM posts
      WHERE created_at >= now() - interval '14 days'
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2
    `);
    return (rows as unknown as { day: string; post_type: string; count: number }[]).map((r) => ({
      day: new Date(r.day).toISOString().slice(0, 10),
      postType: r.post_type,
      count: r.count,
    }));
  }

  private async activeUsers7d(): Promise<number> {
    const { rows } = await this.db.execute(sql`
      SELECT count(DISTINCT user_id)::int AS count FROM (
        SELECT author_user_id AS user_id FROM posts WHERE created_at >= now() - interval '7 days'
        UNION
        SELECT author_user_id FROM comments WHERE created_at >= now() - interval '7 days'
        UNION
        SELECT user_id FROM votes WHERE created_at >= now() - interval '7 days'
      ) active
    `);
    return Number((rows[0] as unknown as { count: number } | undefined)?.count ?? 0);
  }

  private async reportCounts(): Promise<CommunityHealthSummary['reports']> {
    const [{ rows: byStatusRows }, { rows: last7Rows }] = await Promise.all([
      this.db.execute(sql`
        SELECT status, count(*)::int AS count FROM reports
        WHERE created_at >= now() - interval '30 days'
        GROUP BY status
      `),
      this.db.execute(sql`SELECT count(*)::int AS count FROM reports WHERE created_at >= now() - interval '7 days'`),
    ]);

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of byStatusRows as unknown as { status: string; count: number }[]) {
      byStatus[r.status] = r.count;
      total += r.count;
    }
    const resolved = (byStatus.reviewed ?? 0) + (byStatus.actioned ?? 0) + (byStatus.dismissed ?? 0);

    return {
      last7d: Number((last7Rows[0] as unknown as { count: number } | undefined)?.count ?? 0),
      last30d: total,
      byStatus,
      resolutionRatePct: total > 0 ? Math.round((resolved / total) * 1000) / 10 : 0,
    };
  }

  private async highReportRooms(): Promise<CommunityHealthSummary['highReportRooms']> {
    const { rows } = await this.db.execute(sql`
      SELECT cr.id AS room_id, cr.drop_event_id, s.brand, s.model, s.colorway, count(*)::int AS report_count
      FROM reports r
      JOIN chat_messages cm ON cm.id = r.reported_entity_id AND r.reported_entity_type = 'message'
      JOIN chat_rooms cr ON cr.id = cm.room_id
      JOIN drop_events de ON de.id = cr.drop_event_id
      JOIN sneakers s ON s.id = de.sneaker_id
      WHERE r.created_at >= now() - interval '7 days'
      GROUP BY cr.id, cr.drop_event_id, s.brand, s.model, s.colorway
      HAVING count(*) >= ${HIGH_REPORT_ROOM_THRESHOLD}
      ORDER BY report_count DESC
    `);
    return (
      rows as unknown as { room_id: string; drop_event_id: string; brand: string; model: string; colorway: string; report_count: number }[]
    ).map((r) => ({
      roomId: r.room_id,
      dropEventId: r.drop_event_id,
      sneakerLabel: `${r.brand} ${r.model} — ${r.colorway}`,
      reportCount: r.report_count,
    }));
  }
}
