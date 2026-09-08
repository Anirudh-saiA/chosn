import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';
import { classifyText } from '../moderation/classifier.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReviewReportDto } from './dto/review-report.dto';

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
}

/**
 * The `reportEntity(type, id, reason, details)` API from task 1 — this
 * class, with `create()` as its one required method, is the entire
 * contract any future reportable content type needs. A community-posts
 * feature that ships in a later phase doesn't add a `PostReport` table
 * or its own review queue; it calls this with `reportedEntityType:
 * 'post'` and everything else — the queue, the admin view, the
 * reviewer audit trail — already works for it.
 */
@Injectable()
export class ReportsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

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
    return result.rows[0]!; // INSERT ... RETURNING always returns exactly one row on success
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

    return {
      reports: result.rows.map(({ totalCount: _totalCount, ...row }) => row),
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
    return result.rows[0]!;
  }
}
