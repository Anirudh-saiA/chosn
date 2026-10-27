import 'reflect-metadata';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { MarketIntelligenceService } from './market-intelligence.service';

const dialect = new PgDialect();
type Q = Parameters<PgDialect['sqlToQuery']>[0];

interface World {
  lastRun: { at: string; same_day: boolean } | null;
  changedRows: Array<{ id: string; changed: boolean }>;
  retailers?: Array<{ id: string; freq: number }>;
}

function setup(world: World) {
  const statements: string[] = [];
  const params: unknown[][] = [];
  const bgDb = {
    execute: async (q: Q) => {
      const { sql: s, params: p } = dialect.sqlToQuery(q);
      statements.push(s);
      params.push(p);
      if (s.includes('FROM retailers')) return { rows: world.retailers ?? [] };
      if (s.includes('FROM job_state')) return { rows: world.lastRun ? [world.lastRun] : [] };
      if (s.includes('SELECT now()')) return { rows: [{ t: '2026-10-28T10:00:00Z' }] };
      if (s.includes('IS DISTINCT FROM')) return { rows: world.changedRows };
      if (s.includes('SELECT DISTINCT v.id') || s.includes('SELECT DISTINCT sneaker_variant_id AS id')) return { rows: world.changedRows.map((r) => ({ id: r.id })) };
      return { rows: [] };
    },
  };
  const db = { execute: async () => ({ rows: [] }) };
  const svc = new MarketIntelligenceService(db as never, { setMany: async () => undefined } as never, bgDb as never);
  const refreshBatch = vi.spyOn(svc as unknown as { refreshBatch(ids: string[]): Promise<void> }, 'refreshBatch').mockResolvedValue(undefined);
  return { svc, statements, params, refreshBatch };
}

const has = (statements: string[], needle: string) => statements.some((s) => s.includes(needle));

describe('hourly market-intelligence refresh does only what changed', () => {
  it('after a clean run today, recomputes only the variants whose figures differ', async () => {
    const { svc, refreshBatch, statements } = setup({
      lastRun: { at: '2026-10-28T09:00:00Z', same_day: true },
      changedRows: [{ id: 'v1', changed: true }, { id: 'v2', changed: false }, { id: 'v3', changed: true }, { id: 'v4', changed: false }],
    });
    const out = await svc.refreshChanged();
    expect(out).toMatchObject({ mode: 'changed', candidates: 4, processed: 2, failed: 0 });
    expect(refreshBatch).toHaveBeenCalledTimes(1);
    expect(refreshBatch).toHaveBeenCalledWith(['v1', 'v3']);
    expect(has(statements, 'REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_stats_mv')).toBe(true);
  });

  it('the change test compares cheapest price/store and current price/store with the stored summary, on real fresh listings only', async () => {
    const { svc, statements } = setup({ lastRun: { at: '2026-10-28T09:00:00Z', same_day: true }, changedRows: [] });
    await svc.refreshChanged();
    const q = statements.find((s) => s.includes('IS DISTINCT FROM'))!;
    for (const col of ['best_available_price', 'best_retailer_id', 'current_price', 'current_retailer_id']) expect(q).toContain(`ms.${col}`);
    expect(q).toContain('ms.sneaker_variant_id IS NULL'); // a variant with no summary yet
    expect(q).toContain("listing_url NOT LIKE '%FIXTURE%'");
    expect(q).toContain('fetch_frequency_minutes * 2'); // freshness window, also used for "just went stale"
    expect(q).toContain('ps.is_latest = true');
  });

  it('looks for listings that just went stale with one narrow time range per store (twice its own cadence back)', async () => {
    const { svc, statements, params } = setup({
      lastRun: { at: '2026-10-28T09:00:00Z', same_day: true },
      changedRows: [],
      retailers: [{ id: '22222222-2222-2222-2222-222222222222', freq: 10080 }, { id: '33333333-3333-3333-3333-333333333333', freq: 60 }],
    });
    await svc.refreshChanged();
    const i = statements.findIndex((s) => s.includes('IS DISTINCT FROM'));
    expect(statements[i]!.match(/UNION SELECT sneaker_variant_id FROM price_snapshots/g)).toHaveLength(2);
    const asDates = params[i]!.filter((p): p is Date => p instanceof Date).map((d) => d.toISOString());
    const since = Date.parse('2026-10-28T09:00:00Z');
    const until = Date.parse('2026-10-28T10:00:00Z'); // the fake database clock
    expect(asDates).toContain(new Date(since - 2 * 10080 * 60_000).toISOString());
    expect(asDates).toContain(new Date(until - 2 * 10080 * 60_000).toISOString());
    expect(asDates).toContain(new Date(since - 2 * 60 * 60_000).toISOString());
  });

  it('nothing changed: no batch runs, and the run is still recorded', async () => {
    const { svc, refreshBatch, statements } = setup({ lastRun: { at: '2026-10-28T09:00:00Z', same_day: true }, changedRows: [{ id: 'v1', changed: false }] });
    const out = await svc.refreshChanged();
    expect(out).toMatchObject({ mode: 'changed', processed: 0, failed: 0 });
    expect(refreshBatch).not.toHaveBeenCalled();
    expect(has(statements, 'INSERT INTO job_state')).toBe(true);
  });

  it('no store read anything: no views refresh either', async () => {
    const { svc, statements } = setup({ lastRun: { at: '2026-10-28T09:00:00Z', same_day: true }, changedRows: [] });
    await svc.refreshChanged();
    expect(has(statements, 'REFRESH MATERIALIZED VIEW')).toBe(false);
  });

  it('does a full pass on the first run and on a new day, and records it', async () => {
    for (const lastRun of [null, { at: '2026-10-27T09:00:00Z', same_day: false }]) {
      const { svc, statements } = setup({ lastRun, changedRows: [{ id: 'v1', changed: false }, { id: 'v2', changed: false }] });
      const out = await svc.refreshChanged();
      expect(out.mode).toBe('full');
      expect(out.processed).toBe(2); // both, although neither "changed"
      expect(has(statements, 'INSERT INTO job_state')).toBe(true);
    }
  });

  it('a failed batch does not move the starting point forward, so the next run retries it', async () => {
    const { svc, refreshBatch, statements } = setup({ lastRun: { at: '2026-10-28T09:00:00Z', same_day: true }, changedRows: [{ id: 'v1', changed: true }] });
    refreshBatch.mockRejectedValueOnce(new Error('boom'));
    const out = await svc.refreshChanged();
    expect(out.failed).toBe(1);
    expect(has(statements, 'INSERT INTO job_state')).toBe(false);
  });

  it('a partial refresh (one store, or only the sizes an import touched) never moves the starting point', async () => {
    const a = setup({ lastRun: null, changedRows: [{ id: 'v1', changed: true }] });
    await a.svc.refreshAll({ retailerSlug: 'superkicks' });
    expect(has(a.statements, 'INSERT INTO job_state')).toBe(false);
    const b = setup({ lastRun: null, changedRows: [{ id: 'v1', changed: true }] });
    await b.svc.refreshAll({ changedSince: new Date('2026-10-28T00:00:00Z') });
    expect(has(b.statements, 'INSERT INTO job_state')).toBe(false);
  });
});

describe('background jobs use their own small pool', () => {
  it('every refresh statement runs on the background connection, none on the request one', async () => {
    const requestSql: string[] = [];
    const bgSql: string[] = [];
    const mk = (sink: string[]) => ({
      execute: async (q: Q) => {
        const s = dialect.sqlToQuery(q).sql;
        sink.push(s);
        if (s.includes('FROM job_state')) return { rows: [{ at: '2026-10-28T09:00:00Z', same_day: true }] };
        if (s.includes('SELECT now()')) return { rows: [{ t: '2026-10-28T10:00:00Z' }] };
        if (s.includes('IS DISTINCT FROM')) return { rows: [{ id: 'v1', changed: true }] };
        return { rows: [] };
      },
      transaction: async (fn: (t: unknown) => Promise<void>) => fn({ execute: async (q: Q) => void sink.push(dialect.sqlToQuery(q).sql) }),
      select: () => ({ from: () => ({ where: async () => (sink.push('select market_summaries'), []) }) }),
    });
    const svc = new MarketIntelligenceService(mk(requestSql) as never, { setMany: async () => undefined } as never, mk(bgSql) as never);
    await svc.refreshChanged();
    expect(requestSql).toEqual([]);
    expect(bgSql.length).toBeGreaterThan(5);
  });

  it('the pool is separate and small by default', async () => {
    const { pgBgPoolProvider, pgPoolProvider, PG_BG_POOL, PG_POOL } = await import('../db/db.provider');
    expect(PG_BG_POOL).not.toBe(PG_POOL);
    process.env.DATABASE_URL = 'postgres://u:p@127.0.0.1:1/none';
    delete process.env.BG_PG_POOL_MAX;
    const bg = pgBgPoolProvider.useFactory() as unknown as { options: { max: number }; end(): Promise<void> };
    const main = pgPoolProvider.useFactory() as unknown as { options: { max: number }; end(): Promise<void> };
    expect(bg.options.max).toBe(3);
    expect(bg.options.max).toBeLessThan(main.options.max);
    await bg.end();
    await main.end();
  });
});
