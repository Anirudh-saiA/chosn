import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FetchHealthService, isDegraded, type RetailerHealth } from './fetch-health.service';

@Controller('health')
export class FetchHealthController {
  constructor(private readonly health: FetchHealthService) {}

  /**
   * Per-retailer pipeline health. Read-only and non-sensitive — it
   * exposes fetch cadence and success counts, never credentials or
   * prices — so it needs no auth, which also means it can be wired to an
   * uptime check later without handing that service a token.
   */
  @Get('fetch')
  async fetch(): Promise<{ ok: boolean; degraded: string[]; retailers: RetailerHealth[] }> {
    const retailers = await this.health.summary();
    const degraded = retailers.filter(isDegraded);
    return { ok: degraded.length === 0, degraded: degraded.map((r) => r.slug), retailers };
  }

  /**
   * Day 37 — purpose-built for external, non-sandboxed monitoring
   * (cron-job.org and similar), which alert on HTTP status, not on
   * parsing a nested JSON body. `GET /health/fetch` above stays the
   * detailed human diagnostic view; this endpoint's whole job is
   * collapsing that same data into one bit external tooling can act on
   * without understanding this project's schema.
   *
   * Deliberately still returns a JSON body alongside the status code
   * (not just an empty 503) — a human clicking through from a
   * cron-job.org failure email sees exactly which retailer(s) tripped
   * it and why, without a second hop into `/health/fetch`.
   *
   * `@HttpCode(HttpStatus.OK)` on the decorator + `res.status()` below
   * is deliberate, not redundant: Nest's default success status for a
   * plain return is 200 either way, but the method needs to *change*
   * the status for the failure branch, which requires the
   * `@Res({ passthrough: false })`-style raw response object — using it
   * means Nest no longer auto-applies the decorator's status on its
   * own, so the 200 path sets it explicitly too, keeping both branches
   * symmetric rather than one implicit and one explicit.
   */
  @Get('fetch/status')
  @HttpCode(HttpStatus.OK)
  async fetchStatus(@Res() res: Response): Promise<void> {
    const retailers = await this.health.summary();
    const degraded = retailers.filter(isDegraded);

    if (degraded.length === 0) {
      res.status(HttpStatus.OK).json({ ok: true });
      return;
    }

    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      ok: false,
      degraded: degraded.map((r) => ({
        slug: r.slug,
        reason: r.stale && r.failures24h > 0 ? 'stale_and_failing' : r.stale ? 'stale' : 'failing',
        lastSuccessAt: r.lastSuccessAt,
        failures24h: r.failures24h,
      })),
    });
  }
}
