import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { retailerModeFor, type RetailerMode } from '../retailers/retailer-mode';

export interface RetailerHealth {
  slug: string;
  name: string;
  integrationType: string;
  status: string;
  /** Whether credentials exist, or the source runs on fixtures. */
  mode: RetailerMode;
  fetchEveryMinutes: number;
  lastSuccessAt: string | null;
  minutesSinceSuccess: number | null;
  snapshots24h: number;
  failures24h: number;
  /** True when nothing has landed within two full fetch cycles. */
  stale: boolean;
}

/**
 * "Is every source still working?" — the question you can't answer by
 * looking at logs once there are six queues running unattended.
 *
 * Derives success from price_snapshots rather than keeping a separate
 * success log: a snapshot row *is* the evidence of a successful fetch,
 * and a second counter would only ever drift from it. Failures come from
 * fetch_failures, written when a job is dead-lettered.
 *
 * `stale` is deliberately relative to each retailer's own cadence, not a
 * fixed threshold — 3 hours of silence is fine for a weekly boutique and
 * alarming for a 12-hourly feed.
 */
@Injectable()
export class FetchHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FetchHealthService.name);

  private timer?: NodeJS.Timeout;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * Logs the summary at boot and hourly after that. A plain interval
   * rather than a queued job on purpose: this is observability, and it
   * should not stop working because the queue system it observes is the
   * thing that broke.
   */
  onModuleInit(): void {
    if (!process.env.DATABASE_URL || process.env.FETCH_HEALTH_LOG === 'off') return;
    void this.logSummary().catch(() => undefined);
    this.timer = setInterval(() => void this.logSummary().catch(() => undefined), 3_600_000);
    this.timer.unref(); // never hold the process open on its own
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async summary(): Promise<RetailerHealth[]> {
    const { rows } = await this.db.execute(sql`
      SELECT
        r.slug,
        r.name,
        r.integration_type::text                       AS integration_type,
        r.status::text                                 AS status,
        r.fetch_frequency_minutes                      AS fetch_every_minutes,
        s.last_success_at,
        COALESCE(s.snapshots_24h, 0)                   AS snapshots_24h,
        COALESCE(f.failures_24h, 0)                    AS failures_24h
      FROM retailers r
      LEFT JOIN (
        SELECT
          retailer_id,
          MAX(fetched_at)                                                  AS last_success_at,
          COUNT(*) FILTER (WHERE fetched_at > now() - INTERVAL '24 hours') AS snapshots_24h
        FROM price_snapshots
        GROUP BY retailer_id
      ) s ON s.retailer_id = r.id
      LEFT JOIN (
        SELECT retailer_slug, COUNT(*) AS failures_24h
        FROM fetch_failures
        WHERE failed_at > now() - INTERVAL '24 hours'
        GROUP BY retailer_slug
      ) f ON f.retailer_slug = r.slug
      ORDER BY r.name
    `);

    return (rows as Record<string, unknown>[]).map((row) => {
      const lastSuccess = row.last_success_at ? new Date(row.last_success_at as string) : null;
      const cadence = Number(row.fetch_every_minutes);
      const minutesSince = lastSuccess
        ? Math.floor((Date.now() - lastSuccess.getTime()) / 60_000)
        : null;

      return {
        slug: String(row.slug),
        name: String(row.name),
        integrationType: String(row.integration_type),
        status: String(row.status),
        mode: retailerModeFor(String(row.slug), String(row.integration_type)),
        fetchEveryMinutes: cadence,
        lastSuccessAt: lastSuccess ? lastSuccess.toISOString() : null,
        minutesSinceSuccess: minutesSince,
        snapshots24h: Number(row.snapshots_24h),
        failures24h: Number(row.failures_24h),
        // Two cycles of grace: one missed run is a blip, two is a problem.
        stale: minutesSince === null || minutesSince > cadence * 2,
      };
    });
  }

  /** Logged on a schedule so unattended sources aren't silently broken. */
  async logSummary(): Promise<void> {
    const rows = await this.summary();
    for (const r of rows) {
      const line =
        `${r.slug} [${r.mode}] every ${r.fetchEveryMinutes}m | ` +
        `last success ${r.lastSuccessAt ?? 'never'} | ` +
        `24h: ${r.snapshots24h} ok, ${r.failures24h} failed`;
      if (r.stale || r.failures24h > 0) this.logger.warn(`STALE/FAILING ${line}`);
      else this.logger.log(line);
    }
  }
}
