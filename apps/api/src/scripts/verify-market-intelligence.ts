/**
 * Day 9 task 7 — verification report.
 *
 * Two things this proves, independently of the service under test:
 *
 * 1. For 3-5 real launch-catalog variants: re-derives current_price and
 *    best_available_price in plain TypeScript from the raw
 *    price_snapshots rows (own filtering for in_stock/staleness, own
 *    price + shipping arithmetic, own currency conversion via a
 *    separately-queried fx_rates row) and diffs that against what
 *    market_summaries actually stored. Re-calling effective_price_inr()
 *    and re-running the service's own query would only prove the
 *    service agrees with itself — this exercises a second, independent
 *    code path over the same rows.
 * 2. For one variant: prints every number by hand (task 7's explicit
 *    "spot-check the math by hand" ask).
 *
 * The real dev dataset is only a few hours deep (see the report's own
 * note on this), so every real variant currently shows signal
 * 'insufficient_data' — which is the MIN_DAYS_FOR_SIGNAL guard working
 * correctly, not a bug. To prove the trend/signal math itself across all
 * three real buckets, a third section inserts a synthetic 35-day price
 * history for one scratch variant (clearly labeled, cleaned up before
 * the script exits, and excluded from the launch catalog it reports on)
 * — the same technique Day 6 used to verify the composite index against
 * 200k synthetic rows.
 *
 *   npm run mi:verify --workspace=@chosn/api
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import {
  MarketIntelligenceService,
  MIN_DAYS_FOR_SIGNAL,
  SIGNAL_THRESHOLDS,
} from '../pricing/market-intelligence.service';

const logger = new Logger('verify-mi');

interface RawSnapshot {
  retailer_slug: string;
  price: string;
  shipping_cost: string | null;
  currency: string;
  in_stock: boolean;
  // node-postgres returns timestamptz as a string here (raw sql.execute,
  // not a typed drizzle select) — always route through new Date(...).
  fetched_at: string;
  fetch_frequency_minutes: number;
}

function fmtInr(n: number | null): string {
  return n === null ? 'null' : `₹${n.toFixed(2)}`;
}

/** Independent re-implementation — deliberately not calling effective_price_inr(). */
async function independentBest(
  db: Db,
  variantId: string,
  requireInStock: boolean,
): Promise<{ retailerSlug: string; priceInr: number; fetchedAt: Date } | null> {
  const { rows } = await db.execute(sql`
    SELECT ps.price, ps.shipping_cost, ps.currency, ps.in_stock, ps.fetched_at,
           r.slug AS retailer_slug, r.fetch_frequency_minutes
    FROM price_snapshots ps
    JOIN retailers r ON r.id = ps.retailer_id
    WHERE ps.sneaker_variant_id = ${variantId} AND ps.is_latest = true
  `);

  const { rows: fxRows } = await db.execute(sql`SELECT currency, rate_to_inr FROM fx_rates`);
  const fx = new Map((fxRows as { currency: string; rate_to_inr: string }[]).map((r) => [r.currency, Number(r.rate_to_inr)]));

  let winner: { retailerSlug: string; priceInr: number; fetchedAt: Date } | null = null;
  for (const row of rows as unknown as RawSnapshot[]) {
    const fetchedAt = new Date(row.fetched_at);
    const staleCutoffMs = Date.now() - row.fetch_frequency_minutes * 2 * 60_000;
    if (fetchedAt.getTime() < staleCutoffMs) continue; // stale
    if (requireInStock && !row.in_stock) continue;

    const rate = fx.get(row.currency);
    if (rate === undefined) continue; // no fx row — same fail-closed exclusion as the service

    const priceInr = (Number(row.price) + Number(row.shipping_cost ?? 0)) * rate;

    if (requireInStock) {
      if (!winner || priceInr < winner.priceInr) {
        winner = { retailerSlug: row.retailer_slug, priceInr, fetchedAt };
      }
    } else {
      if (!winner || fetchedAt > winner.fetchedAt) {
        winner = { retailerSlug: row.retailer_slug, priceInr, fetchedAt };
      }
    }
  }
  return winner;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const db = app.get<Db>(DRIZZLE);
    const intelligence = app.get(MarketIntelligenceService);

    logger.log('running a fresh refresh so market_summaries reflects current price_snapshots...');
    await intelligence.refreshAll();

    // ---- Section 1: pick up to 5 real launch-catalog variants ----
    const { rows: variantRows } = await db.execute(sql`
      SELECT v.id, s.brand, s.model, s.colorway, v.size, v.size_system
      FROM sneaker_variants v
      JOIN sneakers s ON s.id = v.sneaker_id
      WHERE EXISTS (SELECT 1 FROM retailer_product_mappings rpm WHERE rpm.sneaker_id = s.id)
      ORDER BY s.brand, s.model, v.size
      LIMIT 5
    `);

    console.log('\n=== SECTION 1: real launch-catalog variants, independently re-derived ===\n');

    let mismatches = 0;
    let first = true;
    for (const v of variantRows as {
      id: string;
      brand: string;
      model: string;
      colorway: string;
      size: string;
      size_system: string;
    }[]) {
      const label = `${v.brand} ${v.model} "${v.colorway}" — size ${v.size} ${v.size_system.toUpperCase()}`;

      const [stored] = await db.execute(sql`
        SELECT current_price, current_retailer_slug, best_available_price, best_retailer_slug,
               days_history_30d, signal
        FROM market_summaries WHERE sneaker_variant_id = ${v.id}
      `).then((r) => r.rows as {
        current_price: string | null;
        current_retailer_slug: string | null;
        best_available_price: string | null;
        best_retailer_slug: string | null;
        days_history_30d: number;
        signal: string | null;
      }[]);

      const indepCurrent = await independentBest(db, v.id, false);
      const indepBest = await independentBest(db, v.id, true);

      const storedCurrent = stored?.current_price !== null && stored?.current_price !== undefined ? Number(stored.current_price) : null;
      const storedBest = stored?.best_available_price !== null && stored?.best_available_price !== undefined ? Number(stored.best_available_price) : null;

      const currentMatch = closeEnough(storedCurrent, indepCurrent?.priceInr ?? null);
      const bestMatch = closeEnough(storedBest, indepBest?.priceInr ?? null);
      if (!currentMatch || !bestMatch) mismatches += 1;

      console.log(`${label}`);
      console.log(
        `  current_price:        stored=${fmtInr(storedCurrent)} (${stored?.current_retailer_slug ?? '—'})  ` +
          `independent=${fmtInr(indepCurrent?.priceInr ?? null)} (${indepCurrent?.retailerSlug ?? '—'})  ${currentMatch ? 'MATCH' : 'MISMATCH'}`,
      );
      console.log(
        `  best_available_price: stored=${fmtInr(storedBest)} (${stored?.best_retailer_slug ?? '—'})  ` +
          `independent=${fmtInr(indepBest?.priceInr ?? null)} (${indepBest?.retailerSlug ?? '—'})  ${bestMatch ? 'MATCH' : 'MISMATCH'}`,
      );
      console.log(
        `  days_history_30d=${stored?.days_history_30d ?? 0} (needs ${MIN_DAYS_FOR_SIGNAL}) -> signal=${stored?.signal ?? 'none'}`,
      );

      if (first) {
        await printHandCheck(db, v.id, label);
        first = false;
      }
      console.log('');
    }

    console.log(
      mismatches === 0
        ? `SECTION 1 RESULT: PASS — independent recomputation matches market_summaries for all ${(variantRows as unknown[]).length} variants.`
        : `SECTION 1 RESULT: FAIL — ${mismatches} variant(s) disagree. Investigate before trusting this table.`,
    );

    // ---- Section 2: real data is too shallow to exercise the trend
    // buckets, so prove the math on a synthetic 35-day history instead.
    await runSyntheticSignalCheck(db, intelligence);
  } finally {
    await app.close();
  }
  process.exit(0);
}

function closeEnough(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 0.01; // rounding at the numeric(12,2) boundary
}

async function printHandCheck(db: Db, variantId: string, label: string): Promise<void> {
  console.log(`  --- hand-check for ${label} ---`);
  const { rows } = await db.execute(sql`
    SELECT r.slug AS retailer_slug, ps.price, ps.shipping_cost, ps.currency, ps.in_stock, ps.fetched_at,
           r.fetch_frequency_minutes
    FROM price_snapshots ps JOIN retailers r ON r.id = ps.retailer_id
    WHERE ps.sneaker_variant_id = ${variantId} AND ps.is_latest = true
    ORDER BY r.slug
  `);
  const { rows: fxRows } = await db.execute(sql`SELECT currency, rate_to_inr FROM fx_rates`);
  const fx = new Map((fxRows as { currency: string; rate_to_inr: string }[]).map((r) => [r.currency, Number(r.rate_to_inr)]));

  for (const r of rows as unknown as RawSnapshot[]) {
    const rate = fx.get(r.currency) ?? null;
    const ageMin = Math.round((Date.now() - new Date(r.fetched_at).getTime()) / 60_000);
    const staleAt = r.fetch_frequency_minutes * 2;
    const stale = ageMin > staleAt;
    const eff = rate !== null ? (Number(r.price) + Number(r.shipping_cost ?? 0)) * rate : null;
    console.log(
      `    ${r.retailer_slug.padEnd(14)} price=${r.price} ${r.currency} + shipping=${r.shipping_cost ?? '0'} ` +
        `${rate !== null ? `x rate ${rate} = ${fmtInr(eff)}` : '(no fx rate — excluded)'} | ` +
        `in_stock=${r.in_stock} | age=${ageMin}m (stale past ${staleAt}m: ${stale}) ${stale ? '-> EXCLUDED' : ''}`,
    );
  }
  console.log('    best_available_price = MIN(effective price) over rows that are in_stock AND not stale AND have an fx rate.');
}

const SCRATCH_STYLE_CODE = 'MI-VERIFY-SCRATCH';

/**
 * Synthetic 35-day history on a fully isolated scratch sneaker (its own
 * style_code, its own variant — never referenced by real
 * retailer_product_mappings) — three separate runs so all three signal
 * buckets get exercised against the real thresholds/service code, not a
 * re-statement of them. Using a dedicated scratch variant rather than
 * borrowing a real one means cleanup is a single cascading DELETE and
 * there is no way this touches real pipeline data.
 */
async function runSyntheticSignalCheck(db: Db, intelligence: MarketIntelligenceService): Promise<void> {
  console.log('\n=== SECTION 2: synthetic 35-day history — proves trend/signal math on all 3 buckets ===\n');
  console.log(
    `Thresholds under test: trend_pct <= ${SIGNAL_THRESHOLDS.buyAtOrBelow * 100}% -> good_time_to_buy, ` +
      `>= ${SIGNAL_THRESHOLDS.waitAtOrAbove * 100}% -> consider_waiting, else neutral. ` +
      `Needs >= ${MIN_DAYS_FOR_SIGNAL} days of history or signal is insufficient_data.\n`,
  );

  // Leftover from a previous crashed run, if any — cascades everything.
  await db.execute(sql`DELETE FROM sneakers WHERE style_code = ${SCRATCH_STYLE_CODE}`);

  const [retailer] = await db
    .execute(sql`SELECT id FROM retailers ORDER BY slug LIMIT 1`)
    .then((r) => r.rows as { id: string }[]);
  if (!retailer) {
    console.log('No retailer row exists to attach the scratch variant to — skipping.');
    return;
  }

  const [sneaker] = await db
    .execute(sql`
      INSERT INTO sneakers (brand, model, colorway, style_code, currency)
      VALUES ('Scratch', 'Verification Fixture', 'N/A', ${SCRATCH_STYLE_CODE}, 'INR')
      RETURNING id
    `)
    .then((r) => r.rows as { id: string }[]);
  if (!sneaker) throw new Error('scratch sneaker insert returned no row');

  const [variant] = await db
    .execute(sql`
      INSERT INTO sneaker_variants (sneaker_id, size, size_system, region)
      VALUES (${sneaker.id}, 9.0, 'uk', 'india')
      RETURNING id
    `)
    .then((r) => r.rows as { id: string }[]);
  if (!variant) throw new Error('scratch variant insert returned no row');
  // A mapping row so the variant is picked up by refreshAll()'s
  // "has at least one retailer mapping" filter, same as a real variant.
  await db.execute(sql`
    INSERT INTO retailer_product_mappings (retailer_id, sneaker_id, retailer_raw_title, retailer_product_url, style_code)
    VALUES (${retailer.id}, ${sneaker.id}, 'scratch fixture', 'https://example.test/scratch', ${SCRATCH_STYLE_CODE})
  `);

  const scenarios: { label: string; avgBase: number; todayPrice: number; expect: string }[] = [
    { label: 'declining price', avgBase: 10000, todayPrice: 9000, expect: 'good_time_to_buy' }, // -10%
    { label: 'flat price', avgBase: 10000, todayPrice: 10100, expect: 'neutral' }, // +1%
    { label: 'rising price', avgBase: 10000, todayPrice: 11000, expect: 'consider_waiting' }, // +10%
  ];

  let allPass = true;
  for (const scenario of scenarios) {
    await db.execute(sql`DELETE FROM daily_best_prices WHERE sneaker_variant_id = ${variant.id}`);
    await db.execute(sql`DELETE FROM price_snapshots WHERE sneaker_variant_id = ${variant.id}`);

    // 34 days at avgBase, so avg_30d ~= avgBase; today comes from a real
    // price_snapshots row below, read back through the service's own
    // bestPriceNow() query rather than inserted straight into
    // daily_best_prices, so the query logic under test actually runs.
    for (let daysAgo = 34; daysAgo >= 1; daysAgo -= 1) {
      await db.execute(sql`
        INSERT INTO daily_best_prices (sneaker_variant_id, day, best_price_inr, best_retailer_id)
        VALUES (${variant.id}, CURRENT_DATE - ${daysAgo}::int, ${scenario.avgBase}, ${retailer.id})
      `);
    }
    await db.execute(sql`
      INSERT INTO price_snapshots (
        sneaker_variant_id, retailer_id, price, shipping_cost, currency, condition,
        price_type, in_stock, listing_url, is_latest, fetched_at
      ) VALUES (
        ${variant.id}, ${retailer.id}, ${scenario.todayPrice}, 0, 'INR', 'new',
        'retail', true, 'https://example.test/scratch', true, now()
      )
    `);

    await intelligence.refreshAll();

    const [result] = await db
      .execute(sql`SELECT trend_pct, signal, days_history_30d FROM market_summaries WHERE sneaker_variant_id = ${variant.id}`)
      .then((r) => r.rows as { trend_pct: string; signal: string; days_history_30d: number }[]);

    const pass = result?.signal === scenario.expect;
    allPass = allPass && pass;
    console.log(
      `  ${scenario.label.padEnd(16)} avg_30d≈₹${scenario.avgBase} today=₹${scenario.todayPrice} ` +
        `-> trend_pct=${result?.trend_pct}% days=${result?.days_history_30d} signal=${result?.signal} ` +
        `(expected ${scenario.expect}) ${pass ? 'PASS' : 'FAIL'}`,
    );
  }

  // Single cascading delete: sneaker_variants, price_snapshots,
  // daily_best_prices and market_summaries all reference sneakers (via
  // sneaker_variant_id) with ON DELETE CASCADE, so nothing synthetic
  // survives this script.
  await db.execute(sql`DELETE FROM sneakers WHERE style_code = ${SCRATCH_STYLE_CODE}`);

  console.log(`\nSECTION 2 RESULT: ${allPass ? 'PASS' : 'FAIL'} — scratch sneaker/variant deleted, no real data touched.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
