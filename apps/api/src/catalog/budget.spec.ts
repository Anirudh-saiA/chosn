import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { BUDGET_LIMITS, budgetOffers, clampBudgetParams, toBudgetItem } from './budget';
import { BudgetQueryDto } from './dto/budget-query.dto';

describe('budgetOffers', () => {
  it('keeps kind, text, code, conditions, seenAt and source, and nothing else', () => {
    const [o] = budgetOffers([{ kind: 'coupon', text: '10% off', code: 'SAVE10', conditions: 'Orders over Rs 3000', seenAt: '2026-10-26', source: 'https://store.example/offers', bank: 'HDFC', upTo: 500, url: 'x' }]);
    expect(o).toEqual({ kind: 'coupon', text: '10% off', code: 'SAVE10', conditions: 'Orders over Rs 3000', seenAt: '2026-10-26', source: 'https://store.example/offers' });
  });
  it('drops entries with no text or that are not objects, and nulls missing fields', () => {
    expect(budgetOffers([null, 'x', { kind: 'sale' }, { text: '  ' }, { text: 'Free shipping' }])).toEqual([
      { kind: 'info', text: 'Free shipping', code: null, conditions: null, seenAt: null, source: null },
    ]);
  });
  it('is empty for anything that is not a list, and capped at 8', () => {
    expect(budgetOffers(null)).toEqual([]);
    expect(budgetOffers({ text: 'a' })).toEqual([]);
    expect(budgetOffers(Array.from({ length: 20 }, (_, i) => ({ text: `o${i}` })))).toHaveLength(8);
  });
});

describe('clampBudgetParams', () => {
  it('defaults when missing or not a number', () => {
    expect(clampBudgetParams(undefined, undefined)).toEqual({ max: 5000, limit: 12 });
    expect(clampBudgetParams('abc', {})).toEqual({ max: 5000, limit: 12 });
  });
  it('clamps to the allowed range', () => {
    expect(clampBudgetParams(1, 0)).toEqual({ max: BUDGET_LIMITS.minMax, limit: 1 });
    expect(clampBudgetParams(99_999_999, 9999)).toEqual({ max: BUDGET_LIMITS.maxMax, limit: BUDGET_LIMITS.maxLimit });
  });
});

describe('BudgetQueryDto', () => {
  const check = (q: Record<string, string>) => validate(plainToInstance(BudgetQueryDto, q));
  it('accepts the documented example and no parameters', async () => {
    expect(await check({ max: '5000', limit: '12' })).toHaveLength(0);
    expect(await check({})).toHaveLength(0);
  });
  it('rejects junk with a validation error (a 400, not a database error)', async () => {
    expect((await check({ max: 'abc' })).length).toBeGreaterThan(0);
    expect((await check({ max: '5000.5' })).length).toBeGreaterThan(0);
    expect((await check({ max: '10' })).length).toBeGreaterThan(0);
    expect((await check({ limit: '0' })).length).toBeGreaterThan(0);
    expect((await check({ limit: '500' })).length).toBeGreaterThan(0);
  });
  it('accepts sort=cheapest and sort=popular only', async () => {
    expect(await check({ sort: 'popular' })).toHaveLength(0);
    expect(await check({ sort: 'cheapest' })).toHaveLength(0);
    expect((await check({ sort: 'random' })).length).toBeGreaterThan(0);
    expect((await check({ sort: "popular'; drop table" })).length).toBeGreaterThan(0);
  });
});

describe('toBudgetItem', () => {
  it('maps a row to the response shape, with the store and rupee price', () => {
    const item = toBudgetItem({
      style_code: 'DD1391-100', brand: 'Nike', model: 'Dunk Low', colorway: 'White/Black', primary_image_url: null, size: '9',
      eff: '4499.4', shipping_cost: '0', slug: 'superkicks', store_name: 'Superkicks', listing_url: 'https://superkicks.in/p',
      fetched_at: new Date('2026-10-27T01:00:00Z'), offers: [{ text: 'Free shipping', kind: 'shipping' }], offers_updated_at: '2026-10-26T00:00:00Z', store_count: 4,
    });
    expect(item).toMatchObject({ styleCode: 'DD1391-100', size: 9, priceInr: 4499, shippingCost: 0, store: { slug: 'superkicks', name: 'Superkicks' }, fetchedAt: '2026-10-27T01:00:00.000Z', offersUpdatedAt: '2026-10-26T00:00:00.000Z', storeCount: 4 });
    expect(item.offers).toHaveLength(1);
    expect(item.primaryImageUrl).toBeNull();
  });
  it('has null offersUpdatedAt and no offers when the store has none on file', () => {
    const item = toBudgetItem({ style_code: 'X', brand: 'b', model: 'm', colorway: 'c', size: 8, eff: 1000, slug: 's', store_name: 'S', listing_url: 'u', fetched_at: '2026-10-27T00:00:00Z', offers: null, offers_updated_at: null });
    expect(item.offers).toEqual([]);
    expect(item.offersUpdatedAt).toBeNull();
  });
});
