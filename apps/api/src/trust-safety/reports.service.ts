import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Pool } from 'pg';
import { REDIS_CLIENT } from '../common/redis.provider';
import { PG_POOL } from '../db/db.provider';
import { classifyText } from '../moderation/classifier.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { MODERATION_RETRACT_CHANNEL } from './moderation-events.pubsub';

export interface Report {
  id: string;
  reporterUserId: string;
  reportedEntityType: string;
  reportedEntityId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /**
   * Day 23 fix — see this class's own header comment. Null when the
   * entity no longer exists (deleted, or an id that never matched
   * anything) rather than throwing: a report about since-vanished
   * content is still a report a reviewer should be able to see and
   * dismiss.
   */
  contentPreview: string | null;
  contentAuthorUserId: string | null;
  /** Null for `reportedEntityType: 'user'` — there's no single piece of content to hide for a user-level report. */
  isHidden: boolean | null;
}

const PREVIEW_MAX_LENGTH = 200;

function truncate(text: string): string {
  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH)}…` : text;
}

/**
 * The `reportEntity(type, id, reason, details)` API from task 1 — this
 * class, with `create()` as its one required method, is the entire
 * contract any future reportable content type needs. A community-posts
 * feature that ships in a later phase doesn't add a `PostReport` table
 * or its own review queue; it calls this with `reportedEntityType:
 * 'post'` and everything else — the queue, the admin view, the
 * reviewer audit trail — already works for it.
 *
 * Day 23 QA pass found a real gap this class had shipped with since
 * Day 17/community launch: `review()` only ever flipped `reports.status`
 * — nothing here ever touched the actual post/comment/message a report
 * was about, so "action taken" in the admin queue did nothing to the
 * content itself, and the queue showed only a raw entity id with no way
 * to see what was even being reported. Both are fixed here:
 * `list()`/`get()` now resolve a real `contentPreview` (and
 * `isHidden`) by looking up the reported row in whichever table
 * `reportedEntityType` names, and `review()` sets that row's
 * `is_removed = true` when an admin actions a post/comment/message
 * report — the actual enforcement the moderation flow was missing.
 */
@Injectable()
export class ReportsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(reporterUserId: string, dto: CreateReportDto): Promise<Report> {
    // Best-effort, non-blocking pre-screen (task 6) — a toxicity score
    // on the reporter's own free-text `details` doesn't decide anything
    // here (this is a report *about* content, not the content itself),
    // but it exercises the exact same classifier call path a future
    // post/comment submission will gate on, logged rather than acted
    // on so today's report filing never depends on a classifier being
    // configured or reachable.
    if (dto.details) {
      classifyText(dto.details).catch(() => undefined);
    }

    const result = await this.pool.query<Report>(
      `INSERT INTO reports (reporter_user_id, reported_entity_type, reported_entity_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, reporter_user_id AS "reporterUserId", reported_entity_type AS "reportedEntityType",
                 reported_entity_id AS "reportedEntityId", reason, details, status,
                 created_at AS "createdAt", reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
                 review_note AS "reviewNote"`,
      [reporterUserId, dto.reportedEntityType, dto.reportedEntityId, dto.reason, dto.details ?? null],
    );
    const [withPreview] = await this.attachPreviews([result.rows[0]!]);
    return withPreview!;
  }

  async list(query: ListReportsQueryDto): Promise<{ reports: Report[]; total: number }> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const statusFilter = query.status ? 'WHERE status = $3' : '';
    const params: unknown[] = [limit, offset];
    if (query.status) params.push(query.status);

    const result = await this.pool.query<Report & { totalCount: string }>(
      `SELECT id, reporter_user_id AS "reporterUserId", reported_entity_type AS "reportedEntityType",
              reported_entity_id AS "reportedEntityId", reason, details, status,
              created_at AS "createdAt", reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
              review_note AS "reviewNote", count(*) OVER () AS "totalCount"
       FROM reports
       ${statusFilter}
       -- pending-first, then newest: a reviewer working the queue sees
       -- what still needs action before what's already resolved.
       ORDER BY (status = 'pending') DESC, created_at DESC
       LIMIT $1 OFFSET $2`,
      params,
    );

    const rows = result.rows.map(({ totalCount: _totalCount, ...row }) => row);
    return {
      reports: await this.attachPreviews(rows),
      total: result.rows.length ? Number(result.rows[0]!.totalCount) : 0,
    };
  }

  async review(id: string, adminUserId: string, dto: ReviewReportDto): Promise<Report> {
    const result = await this.pool.query<Report>(
      `UPDATE reports
       SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4
       WHERE id = $1
       RETURNING id, reporter_user_id AS "reporterUserId", reported_entity_type AS "reportedEntityType",
                 reported_entity_id AS "reportedEntityId", reason, details, status,
                 created_at AS "createdAt", reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
                 review_note AS "reviewNote"`,
      [id, dto.status, adminUserId, dto.note ?? null],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({ error: 'not_found', message: 'No report with that id.' });
    }
    const row = result.rows[0]!;

    // The actual enforcement point (see this class's own header
    // comment): actioning a post/comment/message report hides that row
    // from every read path that already filters on is_removed = false
    // (the feed, a post's own page, comment threads, chat history) —
    // same field every one of those queries was already written to
    // respect, just never set from here before now.
    if (dto.status === 'actioned') {
      await this.hideEntity(row.reportedEntityType, row.reportedEntityId);
    }

    const [withPreview] = await this.attachPreviews([row]);
    return withPreview!;
  }

  private async hideEntity(entityType: string, entityId: string): Promise<void> {
    if (entityType === 'post') {
      await this.pool.query('UPDATE posts SET is_removed = true WHERE id = $1', [entityId]);
    } else if (entityType === 'comment') {
      await this.pool.query('UPDATE comments SET is_removed = true WHERE id = $1', [entityId]);
    } else if (entityType === 'message') {
      const result = await this.pool.query<{ room_id: string }>(
        'UPDATE chat_messages SET is_removed = true WHERE id = $1 RETURNING room_id',
        [entityId],
      );
      const roomId = result.rows[0]?.room_id;
      if (roomId) {
        // Same live-retraction shape the classifier's own auto-flag path
        // uses (see ChatMessagesService.classifyAndMaybeRetract) — a
        // client already looking at this room drops the message
        // immediately, not just on next history fetch. Published over
        // Redis rather than a direct call into ChatGateway: TrustSafety
        // and Chat are deliberately independent modules (chat already
        // depends on trust-safety for block enforcement; the reverse
        // import would be circular), and this is the same decoupling
        // every other cross-module broadcast in this codebase already
        // uses (DropSchedulerService -> DropLiveGateway via
        // DROP_LIVE_CHANNEL).
        await this.redis
          .publish(MODERATION_RETRACT_CHANNEL, JSON.stringify({ roomId, messageId: entityId }))
          .catch(() => undefined); // best-effort — the DB write above already did the durable part
      }
    }
    // entityType === 'user': no single content row to hide — a user-level
    // report (harassment via DMs that don't exist yet, a bad-faith
    // profile) has no enforcement primitive in this codebase today
    // beyond what an admin does manually; out of scope for this pass.
  }

  /**
   * Batch-resolves `contentPreview`/`contentAuthorUserId`/`isHidden` for
   * a page of reports — one query per entity type actually present in
   * the page (at most 4: post/comment/message/user), not one query per
   * report. `reported_entity_id` is deliberately not an FK (see the
   * trust-safety migration's own header comment), so this is a manual
   * lookup rather than a join.
   */
  private async attachPreviews(reports: Report[]): Promise<Report[]> {
    if (reports.length === 0) return [];

    const idsByType: Record<string, string[]> = { post: [], comment: [], message: [], user: [] };
    for (const r of reports) {
      if (idsByType[r.reportedEntityType]) idsByType[r.reportedEntityType]!.push(r.reportedEntityId);
    }

    const previews = new Map<string, { preview: string; authorUserId: string | null; isHidden: boolean | null }>();

    if (idsByType.post!.length > 0) {
      const res = await this.pool.query<{ id: string; title: string | null; body: string | null; author_user_id: string; is_removed: boolean }>(
        'SELECT id, title, body, author_user_id, is_removed FROM posts WHERE id = ANY($1)',
        [idsByType.post],
      );
      for (const row of res.rows) {
        previews.set(`post:${row.id}`, {
          preview: truncate([row.title, row.body].filter(Boolean).join(' — ') || '(no title or body)'),
          authorUserId: row.author_user_id,
          isHidden: row.is_removed,
        });
      }
    }
    if (idsByType.comment!.length > 0) {
      const res = await this.pool.query<{ id: string; body: string; author_user_id: string; is_removed: boolean }>(
        'SELECT id, body, author_user_id, is_removed FROM comments WHERE id = ANY($1)',
        [idsByType.comment],
      );
      for (const row of res.rows) {
        previews.set(`comment:${row.id}`, { preview: truncate(row.body), authorUserId: row.author_user_id, isHidden: row.is_removed });
      }
    }
    if (idsByType.message!.length > 0) {
      const res = await this.pool.query<{ id: string; body: string; author_user_id: string; is_removed: boolean }>(
        'SELECT id, body, author_user_id, is_removed FROM chat_messages WHERE id = ANY($1)',
        [idsByType.message],
      );
      for (const row of res.rows) {
        previews.set(`message:${row.id}`, { preview: truncate(row.body), authorUserId: row.author_user_id, isHidden: row.is_removed });
      }
    }
    if (idsByType.user!.length > 0) {
      const res = await this.pool.query<{ id: string; display_name: string | null; email: string }>(
        'SELECT id, display_name, email FROM users WHERE id = ANY($1)',
        [idsByType.user],
      );
      for (const row of res.rows) {
        previews.set(`user:${row.id}`, { preview: row.display_name ?? row.email, authorUserId: row.id, isHidden: null });
      }
    }

    return reports.map((r) => {
      const found = previews.get(`${r.reportedEntityType}:${r.reportedEntityId}`);
      return {
        ...r,
        contentPreview: found?.preview ?? null,
        contentAuthorUserId: found?.authorUserId ?? null,
        isHidden: found?.isHidden ?? null,
      };
    });
  }
}
