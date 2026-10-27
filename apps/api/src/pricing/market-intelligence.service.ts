import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { Queue, Worker } from 'bullmq';
import { DRIZZLE, DRIZZLE_BG, type Db } from '../db/drizzle.provider';
import { marketSummaries } from '../db/schema';
import { bullConnection } from '../queue/queue.config';
import { REAL_LISTING } from './real-listing';
import { MarketIntelligenceCacheService } from './market-intelligence-cache.service';

/**
 * Buy/Neutral/Wait thresholds (Day 9 task 4).
 *
 * SIGNED OFF — widened from the Day 9 brief's own ±5% suggestion to ±8%
 * per explicit review: at typical sneaker price points, ±5% sits close
 * enough to routine day-to-day noise that the signal would flip often
 * and mean less each time. ±8% only fires on a move worth acting on.
 * Change these two constants and every downstream number
 * (already-computed market_summaries rows included, once the next
 * hourly refresh runs) follows.
 *
 *   trend_pct <= -8%           -> "Good Time to Buy"
 *   -8% < trend_pct < +8%      -> "Neutral"
 *   trend_pct >= +8%           -> "Consider Waiting"
 *
 * trend_pct = (current_best - avg_30d) / avg_30d — today's best available
 * price against the 30-day rolling average of daily best prices.
 */
export const SIGNAL_THRESHOLDS = {
  buyAtOrBelow: -0.08,
  waitAtOrAbove: 0.08,
} as const;

/**
 * Fewer real days of daily_best_prices than this and the signal is
 * 'insufficient_data' rather than a guess dressed up as a trend — one or
 * two data points either side of an average is noise, not a trend, and
 * Day 1's transparency principle means saying "gathering data" beats
 * quietly presenting an unreliable one.
 *
 * SIGNED OFF at 7 days — long enough to smooth single-day noise, short
 * enough that a newly-added variant isn't silent for two weeks.
 */
export const MIN_DAYS_FOR_SIGNAL = 7;

export type Signal = 'good_time_to_buy' | 'neutral' | 'consider_waiting' | 'insufficient_data';

export interface MarketIntelligenceSummary {
  sneakerVariantId: string;
  currentPrice: number | null;
  currentRetailerId: string | null;
  currentRetailerSlug: string | null;
  bestAvailablePrice: number | null;
  bestRetailerId: string | null;
  bestRetailerSlug: string | null;
  avg30d: number | null;
  avg90d: number | null;
  /** Percentage points, e.g. -5.23 means 5.23% below the 30-day average — not a raw fraction. */
  trendPct: number | null;
  signal: Signal | null;
  daysHistory30d: number;
  daysHistory90d: number;
  sufficientData: boolean;
  currency: string;
  computedAt: string;
}

const REFRESH_QUEUE = 'market-intelligence-refresh';
const JOB_NAME = 'market-intelligence';

/**
 * Each retailer's current listing per variant (those in `ids`), within twice that retailer's own fetch cadence, real data only, with a
 * known rupee price. One definition for the refresh and for the "what changed" test, so they cannot disagree. Expects a CTE named ids(id).
 */
const freshOffers = (inStockOnly: boolean) => sql`
      SELECT ps.sneaker_variant_id, ps.retailer_id, r.slug AS retailer_slug, ps.fetched_at, ps.in_stock,
             effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price_inr
      FROM price_snapshots ps
      JOIN ids ON ids.id = ps.sneaker_variant_id
      JOIN retailers r ON r.id = ps.retailer_id
      WHERE ps.is_latest = true
        ${inStockOnly ? sql`AND ps.in_stock = true` : sql``}
        AND ps.fetched_at > now() - (r.fetch_frequency_minutes * 2 || ' minutes')::interval
        AND effective_price_inr(ps.price, ps.shipping_cost, ps.currency) IS NOT NULL
        AND ${REAL_LISTING}
    `;
/** Variants per set-based refresh statement. */
const REFRESH_BATCH = 5000;

/**
 * The computation layer behind the Market Intelligence card: turns
 * price_snapshots into current price, best available price, 30/90-day
 * averages, trend %, and the buy/wait signal — precomputed hourly into
 * market_summaries, never aggregated live on a page request.
 *
 * Scheduling follows PriceFetchService's own pattern (BullMQ
 * upsertJobScheduler, not a second scheduling library) rather than
 * introducing @nestjs/schedule for one job.
 */
@Injectable()
export class MarketIntelligenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketIntelligenceService.name);
  private queue?: Queue;
  private worker?: Worker;

  /**
   * `db` serves page requests (the single-row reads below). `bgDb` is the small separate pool every refresh statement runs on, so a long
   * refresh can never take connections away from requests (before: 15 of 150 parallel page requests succeeded while it ran).
   */
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly cache: MarketIntelligenceCacheService,
    @Inject(DRIZZLE_BG) private readonly bgDb: Db,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — market intelligence refresh not started');
      return;
    }

    const connection = bullConnection();
    this.queue = new Queue(REFRESH_QUEUE, { connection });
    this.worker = new Worker(REFRESH_QUEUE, () => this.refreshChanged(), {
      connection,
      concurrency: 1,
    });
    this.worker.on('failed', (_job, err) =>
      this.logger.error(`market intelligence refresh failed: ${err.message}`, err.stack),
    );

    if (process.env.MARKET_INTELLIGENCE_SCHEDULE !== 'off') {
      // upsertJobScheduler fires once immediately on first registration,
      // then every `every` ms — same behavior PriceFetchService already
      // relies on, verified in production (Day 7 queues fired within
      // minutes of deploy with no manual trigger).
      await this.queue.upsertJobScheduler(
        'market-intelligence-hourly',
        { every: 3_600_000 }, // 60 min — matches the cache TTL below
        { name: 'refresh-cycle' },
      );
      this.logger.log('market intelligence refresh scheduled every 60m');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Single-row read for the API/cache layer — never aggregates live. */
  async get(sneakerVariantId: string): Promise<MarketIntelligenceSummary | null> {
    const [row] = await this.db
      .select()
      .from(marketSummaries)
      .where(eq(marketSummaries.sneakerVariantId, sneakerVariantId))
      .limit(1);
    return row ? this.toSummary(row) : null;
  }

  /**
   * Cache-aside read: the one call every consumer (the standalone
   * endpoint, Day 10's catalog page) should use instead of composing
   * cache + get() themselves — one place owns "check cache, fall back to
   * Postgres, warm the cache on a miss" so it can't drift between callers.
   */
  async getCached(sneakerVariantId: string): Promise<MarketIntelligenceSummary | null> {
    const cached = await this.cache.get(sneakerVariantId);
    if (cached) return cached;

    const row = await this.get(sneakerVariantId);
    if (row) await this.cache.set(sneakerVariantId, row);
    return row;
  }

  /**
   * A full pass. For every variant with at least one retailer mapping:
   * finds today's best available price, upserts it into
   * daily_best_prices, reads the 30/90-day window back out, computes
   * trend + signal, and writes the result into market_summaries.
   *
   * One variant's failure is logged and skipped rather than aborting the
   * run — the same per-source isolation principle as the price-fetch
   * queues, applied here to computation instead of fetching.
   *
   * The hourly schedule does not call this every hour: see refreshChanged(). A clean full pass (no options) records itself as the
   * point the next incremental run starts from.
   */
  async refreshAll(opts: { retailerSlug?: string; changedSince?: Date } = {}): Promise<{ processed: number; failed: number }> {
    const startedAt = await this.dbNow();
    await this.warnOnMissingFxRates();

    // changedSince (daily import): only the sizes that got a new snapshot in this run. Everything else keeps
    // its summary until the regular hourly refresh, instead of recomputing ~400k sizes after every import.
    const { rows: variantRows } = opts.changedSince
      ? await this.bgDb.execute(sql`
          SELECT DISTINCT sneaker_variant_id AS id FROM price_snapshots WHERE fetched_at >= ${opts.changedSince}
        `)
      : await this.bgDb.execute(sql`
      SELECT DISTINCT v.id
      FROM sneaker_variants v
      JOIN sneakers s ON s.id = v.sneaker_id
      WHERE ${opts.retailerSlug
        ? sql`EXISTS (SELECT 1 FROM price_snapshots ps JOIN retailers r ON r.id = ps.retailer_id
                      WHERE ps.sneaker_variant_id = v.id AND ps.is_latest = true AND r.slug = ${opts.retailerSlug})`
        : sql`EXISTS (SELECT 1 FROM retailer_product_mappings rpm WHERE rpm.sneaker_id = s.id)
         OR EXISTS (SELECT 1 FROM price_snapshots ps WHERE ps.sneaker_variant_id = v.id AND ps.is_latest = true)`}
    `);

    const result = await this.refreshIds((variantRows as { id: string }[]).map((r) => r.id));
    await this.refreshCatalogViews();
    if (!opts.retailerSlug && !opts.changedSince && result.failed === 0) await this.markRun(startedAt);
    return result;
  }

  /**
   * The hourly job. Recomputes only the variants whose figures can have changed since the last clean run: a store read them again and
   * their cheapest price, cheapest store, current price or current store differ from the stored summary; a listing just aged past its
   * staleness limit; or they have no summary yet. Everything else keeps its row. Once per calendar day (and after any failed run or a
   * first start) it does a full pass instead, which writes the new day's daily_best_prices row for every variant and catches the rare
   * listing that was withdrawn without a replacement.
   */
  async refreshChanged(): Promise<{ mode: 'full' | 'changed'; candidates: number; processed: number; failed: number }> {
    const last = await this.lastRun();
    if (!last || !last.sameDay) {
      const full = await this.refreshAll();
      return { mode: 'full', candidates: full.processed + full.failed, ...full };
    }
    const startedAt = await this.dbNow();
    await this.warnOnMissingFxRates();
    const { candidates, changed } = await this.changedVariantIds(last.at);
    const result = await this.refreshIds(changed);
    // The catalog views count stores and stock too, which can move without the cheapest price moving: refresh them whenever a store read anything.
    if (candidates > 0) await this.refreshCatalogViews();
    this.logger.log(`market intelligence hourly: ${candidates} variants re-read, ${changed.length} changed`);
    if (result.failed === 0) await this.markRun(startedAt);
    return { mode: 'changed', candidates, ...result };
  }

  /**
   * Variants a store re-read (or whose listing just went stale, or that have no summary) since `since`, and the subset whose cheapest
   * price/store or current price/store now differ from market_summaries. Uses the same freshness and real-listing rules as the refresh.
   */
  async changedVariantIds(since: Date): Promise<{ candidates: number; changed: string[] }> {
    // Index-friendly by construction (the monthly partition holds over a million rows): a plain time range for "read again", and for "just went
    // stale" one narrow time range per store, because a listing goes stale 2x that store's own cadence after it was read.
    const until = await this.dbNow();
    const { rows: stores } = await this.bgDb.execute(sql`SELECT id, fetch_frequency_minutes AS freq FROM retailers`);
    const staleBranches = (stores as { id: string; freq: number }[]).map((r) => {
      const lagMs = Number(r.freq) * 2 * 60_000;
      return sql`SELECT sneaker_variant_id FROM price_snapshots
                 WHERE retailer_id = ${r.id}::uuid AND is_latest = true
                   AND fetched_at BETWEEN ${new Date(since.getTime() - lagMs)}::timestamptz AND ${new Date(until.getTime() - lagMs)}::timestamptz`;
    });
    const { rows } = await this.bgDb.execute(sql`
      WITH ids AS (
        SELECT sneaker_variant_id AS id FROM price_snapshots WHERE is_latest = true AND fetched_at >= ${since}::timestamptz
        ${sql.join(staleBranches.map((b) => sql`UNION ${b}`), sql` `)}
        UNION
        SELECT v.id FROM sneaker_variants v
        WHERE NOT EXISTS (SELECT 1 FROM market_summaries ms WHERE ms.sneaker_variant_id = v.id)
          AND EXISTS (SELECT 1 FROM price_snapshots ps WHERE ps.sneaker_variant_id = v.id AND ps.is_latest = true)
      ),
      best AS (
        SELECT DISTINCT ON (sneaker_variant_id) sneaker_variant_id, retailer_id, price_inr
        FROM (${freshOffers(true)}) o
        ORDER BY sneaker_variant_id, price_inr ASC, retailer_id
      ),
      cur AS (
        SELECT DISTINCT ON (sneaker_variant_id) sneaker_variant_id, retailer_id, price_inr
        FROM (${freshOffers(false)}) o
        ORDER BY sneaker_variant_id, in_stock DESC, fetched_at DESC, retailer_id
      )
      SELECT ids.id,
             (ms.sneaker_variant_id IS NULL
              OR round(best.price_inr, 2) IS DISTINCT FROM ms.best_available_price
              OR best.retailer_id IS DISTINCT FROM ms.best_retailer_id
              OR round(cur.price_inr, 2) IS DISTINCT FROM ms.current_price
              OR cur.retailer_id IS DISTINCT FROM ms.current_retailer_id) AS changed
      FROM ids
      LEFT JOIN market_summaries ms ON ms.sneaker_variant_id = ids.id
      LEFT JOIN best ON best.sneaker_variant_id = ids.id
      LEFT JOIN cur ON cur.sneaker_variant_id = ids.id
    `);
    const all = rows as { id: string; changed: boolean }[];
    return { candidates: all.length, changed: all.filter((r) => r.changed).map((r) => r.id) };
  }

  /** Set-based refresh of these variants, REFRESH_BATCH at a time; a failing batch is logged and skipped (the batch-level version of per-variant isolation). */
  private async refreshIds(ids: string[]): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += REFRESH_BATCH) {
      const batch = ids.slice(i, i + REFRESH_BATCH);
      try {
        await this.refreshBatch(batch);
        processed += batch.length;
      } catch (err) {
        failed += batch.length;
        this.logger.error(`refresh failed for ${batch.length} variants (first ${batch[0]}): ${(err as Error).message}`);
      }
    }
    this.logger.log(`market intelligence refresh: ${processed} ok, ${failed} failed`);
    return { processed, failed };
  }

  private async dbNow(): Promise<Date> {
    const { rows } = await this.bgDb.execute(sql`SELECT now() AS t`);
    return new Date((rows[0] as { t: string | Date }).t);
  }

  /** When the last clean run started, and whether that was today (database clock), or null when there has been none. */
  private async lastRun(): Promise<{ at: Date; sameDay: boolean } | null> {
    const { rows } = await this.bgDb.execute(
      sql`SELECT last_run_at AS at, last_run_at::date = CURRENT_DATE AS same_day FROM job_state WHERE name = ${JOB_NAME}`,
    );
    const r = rows[0] as { at: string | Date | null; same_day: boolean } | undefined;
    return r?.at ? { at: new Date(r.at), sameDay: r.same_day } : null;
  }

  private async markRun(startedAt: Date): Promise<void> {
    await this.bgDb.execute(sql`
      INSERT INTO job_state (name, last_run_at, updated_at) VALUES (${JOB_NAME}, ${startedAt}, now())
      ON CONFLICT (name) DO UPDATE SET last_run_at = EXCLUDED.last_run_at, updated_at = now()
    `);
  }

  /** The browse page reads these two materialized views (drizzle/0026); bring them up to date with the prices. */
  async refreshCatalogViews(): Promise<void> {
    await this.bgDb.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_default_variant_mv`);
    await this.bgDb.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_stats_mv`);
    await this.bgDb.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_colors_mv`);
    this.logger.log('catalog views refreshed');
  }

  /**
   * Refreshes a batch of variants in set-based SQL. Same rules the per-variant version had:
   *
   * - "Best Available" (Day 9 task 2): the cheapest in-stock effective price across retailers, using only each
   *   retailer's current row (is_latest) and excluding anything older than twice that retailer's own fetch cadence.
   * - "Current Price" (Day 9 task 1/5): the freshest valid snapshot, in-stock offers first, so a variant out of stock
   *   everywhere still shows what it costs. Deliberately not the same as best_available_price.
   * - Every figure uses real listings only: a placeholder (FIXTURE) row never counts, however fresh or cheap.
   *   Before this, an unapproved store's placeholder could be "current" and sit 140% above the best real price.
   * - Today's best goes into daily_best_prices; no row when nothing is in stock and fresh (a day with no valid offer
   *   is absent from the average, not counted as free).
   * - Trend is a fraction classified against SIGNAL_THRESHOLDS, stored as percentage points in numeric(6,2).
   */
  private async refreshBatch(variantIds: string[]): Promise<void> {
    const idList = sql`SELECT unnest(ARRAY[${sql.join(variantIds.map((v) => sql`${v}`), sql`, `)}]::uuid[]) AS id`;
    const offers = freshOffers;

    await this.bgDb.transaction(async (tx) => {
      // Today's row only: a variant whose "best" was a placeholder (or went out of stock) has no real best now, so a row written by an
      // earlier run today must not linger and feed the 30-day average.
      await tx.execute(sql`
        WITH ids AS (${idList}),
        best AS (SELECT DISTINCT sneaker_variant_id FROM (${offers(true)}) o)
        DELETE FROM daily_best_prices d USING ids
        WHERE d.sneaker_variant_id = ids.id AND d.day = CURRENT_DATE
          AND NOT EXISTS (SELECT 1 FROM best b WHERE b.sneaker_variant_id = d.sneaker_variant_id)
      `);
      await tx.execute(sql`
        WITH ids AS (${idList}),
        best AS (
          SELECT DISTINCT ON (sneaker_variant_id) sneaker_variant_id, retailer_id, price_inr
          FROM (${offers(true)}) o
          ORDER BY sneaker_variant_id, price_inr ASC, retailer_id
        )
        INSERT INTO daily_best_prices (sneaker_variant_id, day, best_price_inr, best_retailer_id, computed_at)
        SELECT sneaker_variant_id, CURRENT_DATE, price_inr, retailer_id, now() FROM best
        ON CONFLICT (sneaker_variant_id, day) DO UPDATE SET
          best_price_inr   = EXCLUDED.best_price_inr,
          best_retailer_id = EXCLUDED.best_retailer_id,
          computed_at       = EXCLUDED.computed_at
      `);

      await tx.execute(sql`
        WITH ids AS (${idList}),
        best AS (
          SELECT DISTINCT ON (sneaker_variant_id) sneaker_variant_id, retailer_id, retailer_slug, price_inr
          FROM (${offers(true)}) o
          ORDER BY sneaker_variant_id, price_inr ASC, retailer_id
        ),
        cur AS (
          SELECT DISTINCT ON (sneaker_variant_id) sneaker_variant_id, retailer_id, retailer_slug, price_inr
          FROM (${offers(false)}) o
          ORDER BY sneaker_variant_id, in_stock DESC, fetched_at DESC, retailer_id
        ),
        agg AS (
          SELECT d.sneaker_variant_id,
            AVG(best_price_inr) FILTER (WHERE day > CURRENT_DATE - INTERVAL '30 days')  AS avg_30d,
            COUNT(*)            FILTER (WHERE day > CURRENT_DATE - INTERVAL '30 days')  AS days_30d,
            AVG(best_price_inr) FILTER (WHERE day > CURRENT_DATE - INTERVAL '90 days')  AS avg_90d,
            COUNT(*)            FILTER (WHERE day > CURRENT_DATE - INTERVAL '90 days')  AS days_90d
          FROM daily_best_prices d JOIN ids ON ids.id = d.sneaker_variant_id
          GROUP BY d.sneaker_variant_id
        ),
        calc AS (
          SELECT ids.id,
            cur.price_inr AS cur_price, cur.retailer_id AS cur_retailer_id, cur.retailer_slug AS cur_retailer_slug,
            best.price_inr AS best_price, best.retailer_id AS best_retailer_id, best.retailer_slug AS best_retailer_slug,
            agg.avg_30d, agg.avg_90d,
            COALESCE(agg.days_30d, 0) AS days_30d, COALESCE(agg.days_90d, 0) AS days_90d,
            COALESCE(agg.days_30d, 0) >= ${MIN_DAYS_FOR_SIGNAL} AS sufficient,
            CASE WHEN COALESCE(agg.days_30d, 0) >= ${MIN_DAYS_FOR_SIGNAL} AND NULLIF(agg.avg_30d, 0) IS NOT NULL
                      AND best.price_inr IS NOT NULL
                 THEN (best.price_inr - agg.avg_30d) / agg.avg_30d END AS frac
          FROM ids
          LEFT JOIN cur ON cur.sneaker_variant_id = ids.id
          LEFT JOIN best ON best.sneaker_variant_id = ids.id
          LEFT JOIN agg ON agg.sneaker_variant_id = ids.id
        )
        INSERT INTO market_summaries (
          sneaker_variant_id, current_price, current_retailer_id, current_retailer_slug,
          best_available_price, best_retailer_id, best_retailer_slug,
          avg_30d, avg_90d, trend_pct, signal,
          days_history_30d, days_history_90d, sufficient_data, currency, computed_at
        )
        SELECT id, cur_price, cur_retailer_id, cur_retailer_slug,
               best_price, best_retailer_id, best_retailer_slug,
               avg_30d, avg_90d, frac * 100,
               CASE WHEN NOT sufficient OR frac IS NULL THEN 'insufficient_data'
                    WHEN frac <= ${SIGNAL_THRESHOLDS.buyAtOrBelow} THEN 'good_time_to_buy'
                    WHEN frac >= ${SIGNAL_THRESHOLDS.waitAtOrAbove} THEN 'consider_waiting'
                    ELSE 'neutral' END,
               days_30d, days_90d, sufficient, 'INR', now()
        FROM calc
        ON CONFLICT (sneaker_variant_id) DO UPDATE SET
          current_price          = EXCLUDED.current_price,
          current_retailer_id    = EXCLUDED.current_retailer_id,
          current_retailer_slug  = EXCLUDED.current_retailer_slug,
          best_available_price   = EXCLUDED.best_available_price,
          best_retailer_id       = EXCLUDED.best_retailer_id,
          best_retailer_slug     = EXCLUDED.best_retailer_slug,
          avg_30d                = EXCLUDED.avg_30d,
          avg_90d                = EXCLUDED.avg_90d,
          trend_pct               = EXCLUDED.trend_pct,
          signal                  = EXCLUDED.signal,
          days_history_30d       = EXCLUDED.days_history_30d,
          days_history_90d       = EXCLUDED.days_history_90d,
          sufficient_data         = EXCLUDED.sufficient_data,
          currency                = EXCLUDED.currency,
          computed_at             = EXCLUDED.computed_at
      `);
    });

    // Write-through, as before: re-read what was committed so the cache holds exactly the stored rows.
    const fresh = await this.bgDb.select().from(marketSummaries).where(inArray(marketSummaries.sneakerVariantId, variantIds));
    await this.cache.setMany(fresh.map((row) => this.toSummary(row)));
  }

  /**
   * A currency with no fx_rates row doesn't crash anything — effective_
   * price_inr() returns NULL and that snapshot is quietly excluded from
   * every ranking and average. Quietly is the problem: this surfaces it
   * as a log line each refresh, so an unconverted currency reads as a
   * visible gap instead of a source that silently stopped affecting
   * "best price" for no apparent reason.
   */
  private async warnOnMissingFxRates(): Promise<void> {
    const { rows } = await this.bgDb.execute(sql`
      SELECT DISTINCT ps.currency
      FROM price_snapshots ps
      WHERE ps.is_latest = true
        AND NOT EXISTS (SELECT 1 FROM fx_rates fx WHERE fx.currency = ps.currency)
    `);
    if (rows.length > 0) {
      const currencies = (rows as { currency: string }[]).map((r) => r.currency).join(', ');
      this.logger.warn(
        `no fx_rates row for: ${currencies} — snapshots in these currencies are excluded from every ranking and average until a rate is added`,
      );
    }
  }

  private toSummary(row: typeof marketSummaries.$inferSelect): MarketIntelligenceSummary {
    return {
      sneakerVariantId: row.sneakerVariantId,
      currentPrice: row.currentPrice !== null ? Number(row.currentPrice) : null,
      currentRetailerId: row.currentRetailerId,
      currentRetailerSlug: row.currentRetailerSlug,
      bestAvailablePrice: row.bestAvailablePrice !== null ? Number(row.bestAvailablePrice) : null,
      bestRetailerId: row.bestRetailerId,
      bestRetailerSlug: row.bestRetailerSlug,
      avg30d: row.avg30d !== null ? Number(row.avg30d) : null,
      avg90d: row.avg90d !== null ? Number(row.avg90d) : null,
      trendPct: row.trendPct !== null ? Number(row.trendPct) : null,
      signal: row.signal as Signal | null,
      daysHistory30d: row.daysHistory30d,
      daysHistory90d: row.daysHistory90d,
      sufficientData: row.sufficientData,
      currency: row.currency,
      computedAt: row.computedAt.toISOString(),
    };
  }
}
