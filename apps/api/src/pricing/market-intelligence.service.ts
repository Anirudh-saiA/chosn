import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { Queue, Worker } from 'bullmq';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { marketSummaries } from '../db/schema';
import { bullConnection } from '../queue/queue.config';
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

interface BestOffer {
  priceInr: string;
  retailerId: string;
  retailerSlug: string;
}

const REFRESH_QUEUE = 'market-intelligence-refresh';

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

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly cache: MarketIntelligenceCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — market intelligence refresh not started');
      return;
    }

    const connection = bullConnection();
    this.queue = new Queue(REFRESH_QUEUE, { connection });
    this.worker = new Worker(REFRESH_QUEUE, () => this.refreshAll(), {
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
   * The hourly job. For every variant with at least one retailer mapping:
   * finds today's best available price, upserts it into
   * daily_best_prices, reads the 30/90-day window back out, computes
   * trend + signal, and writes the result into market_summaries.
   *
   * One variant's failure is logged and skipped rather than aborting the
   * run — the same per-source isolation principle as the price-fetch
   * queues, applied here to computation instead of fetching.
   */
  async refreshAll(): Promise<{ processed: number; failed: number }> {
    await this.warnOnMissingFxRates();

    const { rows: variantRows } = await this.db.execute(sql`
      SELECT DISTINCT v.id
      FROM sneaker_variants v
      JOIN sneakers s ON s.id = v.sneaker_id
      WHERE EXISTS (SELECT 1 FROM retailer_product_mappings rpm WHERE rpm.sneaker_id = s.id)
    `);

    let processed = 0;
    let failed = 0;
    for (const { id } of variantRows as { id: string }[]) {
      try {
        await this.refreshOne(id);
        processed += 1;
      } catch (err) {
        failed += 1;
        this.logger.error(`refresh failed for variant ${id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`market intelligence refresh: ${processed} ok, ${failed} failed`);
    return { processed, failed };
  }

  private async refreshOne(variantId: string): Promise<void> {
    const [current, best] = await Promise.all([
      this.currentPriceNow(variantId),
      this.bestPriceNow(variantId),
    ]);

    if (best) {
      await this.db.execute(sql`
        INSERT INTO daily_best_prices (sneaker_variant_id, day, best_price_inr, best_retailer_id, computed_at)
        VALUES (${variantId}, CURRENT_DATE, ${best.priceInr}, ${best.retailerId}, now())
        ON CONFLICT (sneaker_variant_id, day) DO UPDATE SET
          best_price_inr   = EXCLUDED.best_price_inr,
          best_retailer_id = EXCLUDED.best_retailer_id,
          computed_at       = EXCLUDED.computed_at
      `);
    }
    // No row written when nothing is in stock and fresh today — a day
    // with no valid offer is absent from the average, not counted as
    // free or interpolated from stale data.

    const { rows } = await this.db.execute(sql`
      SELECT
        AVG(best_price_inr) FILTER (WHERE day > CURRENT_DATE - INTERVAL '30 days')  AS avg_30d,
        COUNT(*)            FILTER (WHERE day > CURRENT_DATE - INTERVAL '30 days')  AS days_30d,
        AVG(best_price_inr) FILTER (WHERE day > CURRENT_DATE - INTERVAL '90 days')  AS avg_90d,
        COUNT(*)            FILTER (WHERE day > CURRENT_DATE - INTERVAL '90 days')  AS days_90d
      FROM daily_best_prices
      WHERE sneaker_variant_id = ${variantId}
    `);
    const agg = rows[0] as {
      avg_30d: string | null;
      days_30d: string;
      avg_90d: string | null;
      days_90d: string;
    };

    const avg30 = agg.avg_30d !== null ? Number(agg.avg_30d) : null;
    const avg90 = agg.avg_90d !== null ? Number(agg.avg_90d) : null;
    const days30 = Number(agg.days_30d);
    const days90 = Number(agg.days_90d);
    const sufficientData = days30 >= MIN_DAYS_FOR_SIGNAL;

    // A fraction first (-0.0523), classified against the ±5% thresholds
    // as fractions — then converted to percentage points (-5.23) only
    // for storage/display, since numeric(6,2) needs the value already
    // scaled to keep two meaningful decimal places. Storing the raw
    // fraction at scale 2 would round -0.0523 to -0.05, losing exactly
    // the precision the threshold comparison needs.
    const trendFraction =
      sufficientData && avg30 && best ? (Number(best.priceInr) - avg30) / avg30 : null;
    const trendPct = trendFraction !== null ? trendFraction * 100 : null;

    const signal: Signal = !sufficientData
      ? 'insufficient_data'
      : trendFraction === null
        ? 'insufficient_data'
        : trendFraction <= SIGNAL_THRESHOLDS.buyAtOrBelow
          ? 'good_time_to_buy'
          : trendFraction >= SIGNAL_THRESHOLDS.waitAtOrAbove
            ? 'consider_waiting'
            : 'neutral';

    await this.db.execute(sql`
      INSERT INTO market_summaries (
        sneaker_variant_id, current_price, current_retailer_id, current_retailer_slug,
        best_available_price, best_retailer_id, best_retailer_slug,
        avg_30d, avg_90d, trend_pct, signal,
        days_history_30d, days_history_90d, sufficient_data, currency, computed_at
      ) VALUES (
        ${variantId}, ${current?.priceInr ?? null}, ${current?.retailerId ?? null}, ${current?.retailerSlug ?? null},
        ${best?.priceInr ?? null}, ${best?.retailerId ?? null}, ${best?.retailerSlug ?? null},
        ${avg30}, ${avg90}, ${trendPct}, ${signal},
        ${days30}, ${days90}, ${sufficientData}, 'INR', now()
      )
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

    // Write-through: the next request for this variant should find it
    // already warm rather than being the one paying for the Postgres
    // read. get() re-reads to pick up exactly what was just committed
    // rather than reassembling the row by hand here.
    const fresh = await this.get(variantId);
    if (fresh) await this.cache.set(variantId, fresh);
  }

  /**
   * "Best Available" (Day 9 task 2): the cheapest in-stock effective
   * price across retailers, using only each retailer's current row
   * (is_latest = true — the flag price-snapshot.service.ts flips
   * transactionally on every write) and excluding anything older than
   * twice that retailer's own fetch cadence, so a source that has gone
   * quiet doesn't keep contributing a stale "best" price forever.
   */
  private async bestPriceNow(variantId: string): Promise<BestOffer | null> {
    const { rows } = await this.db.execute(sql`
      SELECT ps.retailer_id, r.slug AS retailer_slug,
             effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price_inr
      FROM price_snapshots ps
      JOIN retailers r ON r.id = ps.retailer_id
      WHERE ps.sneaker_variant_id = ${variantId}
        AND ps.is_latest = true
        AND ps.in_stock = true
        AND ps.fetched_at > now() - (r.fetch_frequency_minutes * 2 || ' minutes')::interval
        AND effective_price_inr(ps.price, ps.shipping_cost, ps.currency) IS NOT NULL
      ORDER BY price_inr ASC
      LIMIT 1
    `);
    const row = rows[0] as
      | { retailer_id: string; retailer_slug: string; price_inr: string }
      | undefined;
    return row ? { priceInr: row.price_inr, retailerId: row.retailer_id, retailerSlug: row.retailer_slug } : null;
  }

  /**
   * "Current Price" (Day 9 task 1/5) — ASSUMPTION, flagged alongside the
   * signal thresholds: deliberately NOT the same as best_available_price.
   * This is the freshest valid snapshot regardless of stock status, so a
   * variant that's temporarily out of stock everywhere still shows "what
   * this costs" instead of going blank, while best_available_price stays
   * strictly the cheapest in-stock offer right now. They usually match;
   * when they don't, current_price answers "what's the going rate" and
   * best_available_price answers "where would I actually buy it."
   */
  private async currentPriceNow(variantId: string): Promise<BestOffer | null> {
    const { rows } = await this.db.execute(sql`
      SELECT ps.retailer_id, r.slug AS retailer_slug,
             effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price_inr
      FROM price_snapshots ps
      JOIN retailers r ON r.id = ps.retailer_id
      WHERE ps.sneaker_variant_id = ${variantId}
        AND ps.is_latest = true
        AND ps.fetched_at > now() - (r.fetch_frequency_minutes * 2 || ' minutes')::interval
        AND effective_price_inr(ps.price, ps.shipping_cost, ps.currency) IS NOT NULL
      ORDER BY ps.fetched_at DESC
      LIMIT 1
    `);
    const row = rows[0] as
      | { retailer_id: string; retailer_slug: string; price_inr: string }
      | undefined;
    return row ? { priceInr: row.price_inr, retailerId: row.retailer_id, retailerSlug: row.retailer_slug } : null;
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
    const { rows } = await this.db.execute(sql`
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
