import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { BudgetQueryDto } from './dto/budget-query.dto';

const dialect = new PgDialect();
type Q = Parameters<PgDialect['sqlToQuery']>[0];

/** A CatalogService over a database that only records the SQL it is asked to run. */
function recorder(rows: Array<Record<string, unknown>> = []) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    execute: async (q: Q) => {
      const { sql, params } = dialect.sqlToQuery(q);
      statements.push({ sql, params });
      return { rows };
    },
  };
  return { svc: new CatalogService(db as never, {} as never), statements };
}

const hides = (s: string) => /footwear_type\s*=\s*'sneaker'/.test(s);

describe('slides, sandals and boots are hidden from every public read (footwear_type)', () => {
  it('search: the shoe list and the facet counts both filter, and so does the brand list', async () => {
    const { svc, statements } = recorder();
    await svc.search({});
    const withSneakers = statements.filter((s) => s.sql.includes('FROM sneakers s'));
    expect(withSneakers.length).toBeGreaterThanOrEqual(2); // results and facets
    for (const s of withSneakers) expect(hides(s.sql)).toBe(true);
    const brandList = statements.find((s) => s.sql.includes('SELECT brand FROM sneakers'));
    expect(brandList && hides(brandList.sql)).toBe(true);
  });

  it('search with a typed query and sort options keeps the filter (it is not one of the optional conditions)', async () => {
    const { svc, statements } = recorder();
    await svc.search({ q: 'dunk', brand: 'Nike', sort: 'price_asc', includeSoldOut: true });
    const shoeQueries = statements.filter((s) => s.sql.includes('FROM sneakers s'));
    expect(shoeQueries.length).toBeGreaterThan(0);
    for (const s of shoeQueries) expect(hides(s.sql)).toBe(true);
  });

  it.each([
    ['discounts', (svc: CatalogService) => svc.discounts(10, 20)],
    ['price-drops', (svc: CatalogService) => svc.priceDrops(10, 15)],
    ['stores', (svc: CatalogService) => svc.storeSummary()],
    ['similar', (svc: CatalogService) => svc.similar('DD1391-100', 8)],
    ['colours', (svc: CatalogService) => svc.colours('DD1391-100')],
    ['variants (sitemap)', (svc: CatalogService) => svc.listVariantParams()],
  ])('%s leaves non-sneakers out', async (_name, call) => {
    const { svc, statements } = recorder();
    await call(svc);
    expect(statements.some((s) => hides(s.sql))).toBe(true);
  });

  it.each(['cheapest', 'popular', 'trending'] as const)('budget sort=%s: the shortlist and the eligible shoes both leave non-sneakers out', async (sort) => {
    const { svc, statements } = recorder();
    await svc.budget(5000, 10, sort);
    expect(statements).toHaveLength(1);
    const s = statements[0]!.sql;
    expect(s.match(/footwear_type\s*=\s*'sneaker'/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('/catalog/budget ranking, one card per model, delivery', () => {
  const row = (over: Record<string, unknown>) => ({
    style_code: 'A-1', brand: 'Nike', model: 'Dunk Low', colorway: 'White', primary_image_url: null, size: 9, eff: 4500, shipping_cost: 0,
    slug: 'superkicks', store_name: 'Superkicks', listing_url: 'https://x', fetched_at: '2026-10-28T00:00:00Z', offers: [], offers_updated_at: null,
    store_count: 3, delivery_min_days: 3, delivery_max_days: 6, trend_score: 0, ...over,
  });

  it('trending reads popular_daily over the window and orders by score, then stores, then price', async () => {
    const { svc, statements } = recorder();
    await svc.budget(5000, 10, 'trending', 3);
    const { sql, params } = statements[0]!;
    expect(sql).toContain('FROM popular_daily');
    expect(sql).toContain('sum(views + clicks)');
    expect(sql).toMatch(/COALESCE\(sc\.score, 0\) DESC, st\.store_count DESC, st\.min_price ASC/);
    expect(sql).toMatch(/trend_score DESC, store_count DESC, eff ASC/);
    expect(params).toContain(3); // the window in days
  });

  it('cheapest and popular do not read traffic and keep their own orders', async () => {
    const cheapest = recorder();
    await cheapest.svc.budget(5000, 10, 'cheapest');
    expect(cheapest.statements[0]!.sql).toMatch(/WHERE false/);
    expect(cheapest.statements[0]!.sql).not.toMatch(/store_count DESC, eff ASC/);
    const popular = recorder();
    await popular.svc.budget(5000, 10, 'popular');
    expect(popular.statements[0]!.sql).toMatch(/ORDER BY store_count DESC, eff ASC/);
    expect(popular.statements[0]!.sql).not.toMatch(/trend_score DESC/);
  });

  it('keeps the two-or-more-stores rule (all stores counted) for popular and trending, not for cheapest', async () => {
    for (const sort of ['popular', 'trending'] as const) {
      const { svc, statements } = recorder();
      await svc.budget(5000, 10, sort);
      expect(statements[0]!.sql.match(/store_count >= \$\d+/g)?.length).toBe(2);
      expect(statements[0]!.params.filter((p) => p === 2).length).toBe(2);
    }
    const { svc, statements } = recorder();
    await svc.budget(5000, 10, 'cheapest');
    expect(statements[0]!.sql).not.toMatch(/store_count >= \$/);
  });

  it('collapses colourways: one row per brand + model, in both the shortlist and the result', async () => {
    const { svc, statements } = recorder();
    await svc.budget(5000, 10, 'trending');
    const sql = statements[0]!.sql;
    expect(sql).toContain("PARTITION BY lower(s.brand) || '|' || regexp_replace(lower(s.model)");
    expect(sql).toContain("PARTITION BY grp");
    expect(sql).toContain('WHERE rn = 1');
  });

  it('returns delivery days and the trend score in each item', async () => {
    const { svc } = recorder([row({ trend_score: 5 }), row({ style_code: 'B-1', model: 'AF1', delivery_min_days: null, delivery_max_days: null })]);
    const { items } = await svc.budget(5000, 10, 'trending');
    expect(items[0]).toMatchObject({ deliveryMinDays: 3, deliveryMaxDays: 6, trendScore: 5 });
    expect(items[1]).toMatchObject({ deliveryMinDays: null, deliveryMaxDays: null, trendScore: 0 });
  });

  it('says which ranking it used: trending when there is traffic, store count when there is none, price for cheapest', async () => {
    expect((await recorder([row({ trend_score: 2 })]).svc.budget(5000, 10, 'trending')).ranking).toBe('trending');
    expect((await recorder([row({}), row({ style_code: 'B' })]).svc.budget(6000, 10, 'trending')).ranking).toBe('stores');
    expect((await recorder([row({})]).svc.budget(7000, 10, 'popular')).ranking).toBe('stores');
    expect((await recorder([row({})]).svc.budget(8000, 10, 'cheapest')).ranking).toBe('price');
  });

  it('the endpoint puts ranking and days in the response', async () => {
    const calls: unknown[][] = [];
    const catalog = { budget: async (...a: unknown[]) => (calls.push(a), { ranking: 'stores', items: [] }) };
    const ctl = new CatalogController(catalog as never);
    const out = await ctl.budget({ max: 10000, limit: 10, sort: 'trending', days: 3 });
    expect(out).toEqual({ max: 10000, sort: 'trending', ranking: 'stores', days: 3, items: [] });
    expect(calls[0]).toEqual([10000, 10, 'trending', 3]);
    expect((await ctl.budget({})).days).toBeNull();
  });
});

describe('BudgetQueryDto sort=trending and days', () => {
  const check = (q: Record<string, string>) => validate(plainToInstance(BudgetQueryDto, q));
  it('accepts trending and days 1 to 7', async () => {
    expect(await check({ sort: 'trending', days: '1' })).toHaveLength(0);
    expect(await check({ sort: 'trending', days: '7' })).toHaveLength(0);
  });
  it('rejects days outside 1 to 7 or not a whole number', async () => {
    for (const days of ['0', '8', '-1', 'x', '2.5']) expect((await check({ days })).length).toBeGreaterThan(0);
  });
});
