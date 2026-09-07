/**
 * One-time historical backfill for daily_best_prices.
 *
 * The hourly job (MarketIntelligenceService.refreshAll) only ever writes
 * *today's* row, using is_latest — cheap, because "the current latest
 * snapshot per retailer" is exactly what that flag already points at. It
 * has no way to answer "what was the best price on a day three weeks
 * ago," because is_latest only ever reflects the present. This script
 * answers that instead, once, using an AS-OF join: for each day in the
 * window, the latest snapshot per retailer that existed *as of that
 * day's end*.
 *
 * Safe to run more than once — every write is an upsert keyed on
 * (sneaker_variant_id, day), and a day that already has a row from a
 * previous run or the hourly job is simply overwritten with the same
 * as-of computation.
 *
 * Bounded to 90 days back or the earliest price_snapshots row,
 * whichever is later — there is nothing to backfill before data exists,
 * and the dev dataset today is only hours deep (see the verification
 * report), so this mostly matters once real fetch history accumulates.
 *
 *   npm run mi:backfill --workspace=@chosn/api
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { MarketIntelligenceService } from '../pricing/market-intelligence.service';

const logger = new Logger('mi-backfill');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const db = app.get<Db>(DRIZZLE);

    const [bounds] = await db
      .execute(sql`SELECT MIN(fetched_at)::date AS earliest FROM price_snapshots`)
      .then((r) => r.rows as { earliest: string | null }[]);

    // Deliberately no early `return` here: this whole block is one
    // branch of an if/else so every path falls through to `finally` and
    // then to `process.exit(0)` below. An early return out of `try` runs
    // `finally` but then exits the function immediately after — skipping
    // that final process.exit(0) and leaving the pg Pool / ioredis
    // client (plain factory providers Nest has no lifecycle hook to
    // close) holding the event loop open forever. Caught by actually
    // running this against an empty database, not by inspection.
    if (!bounds?.earliest) {
      logger.warn('price_snapshots is empty — nothing to backfill.');
    } else {
      logger.log(`backfilling daily_best_prices for every mapped variant since ${bounds.earliest} (capped at 90 days)...`);

      // One INSERT ... SELECT: generate_series(earliest, today) crossed
      // with every mapped variant, and for each (variant, day) a LATERAL
      // "latest snapshot per retailer as of that day's end" — the same
      // as-of-join pattern the Day 9 brief calls for, just computed once
      // over history instead of once per hour for "today."
      const { rowCount } = await db.execute(sql`
        INSERT INTO daily_best_prices (sneaker_variant_id, day, best_price_inr, best_retailer_id, computed_at)
        SELECT v.id, d.day, b.price_inr, b.retailer_id, now()
        FROM sneaker_variants v
        JOIN sneakers s ON s.id = v.sneaker_id
        CROSS JOIN LATERAL generate_series(
          GREATEST(${bounds.earliest}::date, CURRENT_DATE - INTERVAL '89 days'),
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS d(day)
        CROSS JOIN LATERAL (
          SELECT effective_price_inr(latest.price, latest.shipping_cost, latest.currency) AS price_inr,
                 latest.retailer_id
          FROM (
            -- latest snapshot per retailer as of the end of d.day
            SELECT DISTINCT ON (ps.retailer_id)
              ps.retailer_id, ps.price, ps.shipping_cost, ps.currency, ps.in_stock, ps.fetched_at,
              r.fetch_frequency_minutes
            FROM price_snapshots ps
            JOIN retailers r ON r.id = ps.retailer_id
            WHERE ps.sneaker_variant_id = v.id
              AND ps.fetched_at <= d.day + INTERVAL '1 day'
            ORDER BY ps.retailer_id, ps.fetched_at DESC
          ) latest
          WHERE latest.in_stock = true
            AND latest.fetched_at > (d.day + INTERVAL '1 day') - (latest.fetch_frequency_minutes * 2 || ' minutes')::interval
            AND effective_price_inr(latest.price, latest.shipping_cost, latest.currency) IS NOT NULL
          ORDER BY price_inr ASC
          LIMIT 1
        ) b
        WHERE EXISTS (SELECT 1 FROM retailer_product_mappings rpm WHERE rpm.sneaker_id = s.id)
        ON CONFLICT (sneaker_variant_id, day) DO UPDATE SET
          best_price_inr   = EXCLUDED.best_price_inr,
          best_retailer_id = EXCLUDED.best_retailer_id,
          computed_at       = EXCLUDED.computed_at
      `);

      logger.log(`backfill wrote/updated ${rowCount ?? 'an unknown number of'} daily_best_prices row(s)`);

      logger.log('recomputing market_summaries from the backfilled history...');
      const result = await app.get(MarketIntelligenceService).refreshAll();
      logger.log(`market_summaries refresh: ${result.processed} ok, ${result.failed} failed`);
    }
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
