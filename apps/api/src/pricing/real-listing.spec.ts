import 'reflect-metadata';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { MarketIntelligenceService } from './market-intelligence.service';
import { REAL_LISTING } from './real-listing';

const dialect = new PgDialect();
const text = (q: Parameters<PgDialect['sqlToQuery']>[0]) => dialect.sqlToQuery(q).sql;

describe('placeholder listings never reach the market readout', () => {
  it('REAL_LISTING excludes FIXTURE urls', () => {
    expect(text(REAL_LISTING)).toContain("listing_url NOT LIKE '%FIXTURE%'");
  });

  it('every price_snapshots statement the refresh runs filters placeholders out', async () => {
    const statements: string[] = [];
    const tx = { execute: async (q: Parameters<PgDialect['sqlToQuery']>[0]) => void statements.push(text(q)) };
    const db = {
      transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
      select: () => ({ from: () => ({ where: async () => [] }) }),
    };
    const svc = new MarketIntelligenceService(db as never, { setMany: async () => undefined } as never, db as never);
    await (svc as unknown as { refreshBatch(ids: string[]): Promise<void> }).refreshBatch(['11111111-1111-1111-1111-111111111111']);

    const touching = statements.filter((s) => s.includes('price_snapshots'));
    expect(touching.length).toBeGreaterThanOrEqual(3); // stale-day cleanup, daily best, summary
    for (const s of touching) expect(s).toContain("listing_url NOT LIKE '%FIXTURE%'");
  });

  it('prefers an in-stock offer for the current price and clears today\'s row when no real best remains', async () => {
    const statements: string[] = [];
    const tx = { execute: async (q: Parameters<PgDialect['sqlToQuery']>[0]) => void statements.push(text(q)) };
    const db = { transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx), select: () => ({ from: () => ({ where: async () => [] }) }) };
    const svc = new MarketIntelligenceService(db as never, { setMany: async () => undefined } as never, db as never);
    await (svc as unknown as { refreshBatch(ids: string[]): Promise<void> }).refreshBatch(['11111111-1111-1111-1111-111111111111']);
    expect(statements.some((s) => s.includes('ORDER BY sneaker_variant_id, in_stock DESC, fetched_at DESC'))).toBe(true);
    expect(statements.some((s) => s.includes('DELETE FROM daily_best_prices') && s.includes('CURRENT_DATE'))).toBe(true);
  });
});
