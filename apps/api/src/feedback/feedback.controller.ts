import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import type { Pool } from 'pg';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { PG_POOL } from '../db/db.provider';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';

/**
 * Day 19 task 8.
 *
 * POST is deliberately **unauthenticated** — a soft-launch tester who
 * hit a confusing wall before signing up is exactly the person whose
 * feedback matters most, and requiring an account to complain filters
 * out the reports you most need. Rate-limited instead, per the same
 * convention as the other public POSTs (waitlist, notifications).
 *
 * GET is admin-only: free-text feedback can contain anything the
 * submitter chose to put in it, including their own contact details.
 */
@Controller('feedback')
export class FeedbackController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  async create(@Body() dto: CreateFeedbackDto) {
    await this.pool.query(
      `INSERT INTO feedback (topic, message, contact_email, source_path)
       VALUES ($1, $2, $3, $4)`,
      [dto.topic ?? 'other', dto.message, dto.contactEmail ?? null, dto.sourcePath ?? null],
    );
    return { ok: true };
  }

  @Get()
  @UseGuards(ApiAuthGuard, AdminGuard)
  async list(@Query() query: ListFeedbackQueryDto) {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const result = await this.pool.query(
      `SELECT id, user_id AS "userId", contact_email AS "contactEmail", topic, message,
              source_path AS "sourcePath", created_at AS "createdAt"
       FROM feedback
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { feedback: result.rows };
  }
}
