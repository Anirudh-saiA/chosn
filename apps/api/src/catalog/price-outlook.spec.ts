import { describe, expect, it } from 'vitest';
import { nextSale, scoreOutlook, type OutlookInput } from './price-outlook';

const hist = (prices: number[]) => prices.map((price, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, price }));
const base: OutlookInput = {
  bestPrice: 8000,
  storePrices: [8000, 8200, 8300],
  wasPrice: null,
  history: [],
  storesInStock: 3,
  sizesInStock: 8,
  sizesKnown: 10,
  peer: null,
  today: new Date('2026-10-20T00:00:00+05:30'),
};

describe('scoreOutlook', () => {
  it('says buy now at the lowest price in its history', () => {
    const o = scoreOutlook({ ...base, bestPrice: 7000, storePrices: [7000, 8000, 8200], history: hist([9000, 8800, 8700, 8500, 8200, 7800, 7500, 7000]) });
    expect(o.verdict).toBe('buy_now');
    expect(o.factors.some((f) => f.label === 'At its lowest price yet')).toBe(true);
  });

  it('says wait when well above its recent average', () => {
    const o = scoreOutlook({
      ...base,
      bestPrice: 10500,
      storePrices: [10500, 10600],
      history: hist([8000, 8000, 8100, 8000, 8000, 8100, 8000, 10500]),
      peer: { n: 400, dropShare: 0.3, windowDays: 10 },
    });
    expect(o.verdict).toBe('wait');
  });

  it('does not use trend with under 7 days of history', () => {
    const o = scoreOutlook({ ...base, history: hist([8000, 8000, 8000]) });
    expect(o.factors.some((f) => f.label === 'Short price history')).toBe(true);
    expect(o.confidence).toBe('low');
  });

  it('refuses to call it with almost no evidence', () => {
    const o = scoreOutlook({ ...base, storePrices: [8000], storesInStock: 1, sizesInStock: 8 });
    expect(o.verdict).toBe('unclear');
  });

  it('handles a shoe that is not in stock', () => {
    expect(scoreOutlook({ ...base, bestPrice: null, storePrices: [] }).verdict).toBe('unclear');
  });

  it('adds urgency when only a size or two is left at one store', () => {
    const o = scoreOutlook({ ...base, storePrices: [8000], storesInStock: 1, sizesInStock: 1, sizesKnown: 10, wasPrice: 12000 });
    expect(o.factors.some((f) => f.label === 'Running low')).toBe(true);
  });

  it('keeps the score within -100..100', () => {
    const o = scoreOutlook({ ...base, history: hist([9000, 9000, 9000, 9000, 9000, 9000, 9000, 5000]), bestPrice: 5000, storePrices: [5000, 9000], wasPrice: 9000 });
    expect(o.score).toBeLessThanOrEqual(100);
    expect(o.score).toBeGreaterThanOrEqual(-100);
  });
});

describe('flat price history', () => {
  it('is not a record low when the price never moved', () => {
    const o = scoreOutlook({ ...base, history: hist([8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000]) });
    expect(o.factors.some((f) => f.label === 'At its lowest price yet')).toBe(false);
    expect(o.factors.some((f) => f.label === 'Price has not moved')).toBe(true);
  });
});

describe('cheaper store sold out', () => {
  it('does not tell you to wait when the price only jumped because the cheap listing is gone', () => {
    const h = [5400, 5400, 5400, 5400, 5400, 5400, 18200, 18200].map((price, k) => ({ day: `2026-10-${String(k + 1).padStart(2, '0')}`, price, store: k < 6 ? 'Superkicks' : 'Mainstreet' }));
    const o = scoreOutlook({ ...base, bestPrice: 18200, storePrices: [18200], storesInStock: 1, history: h });
    expect(o.verdict).not.toBe('wait');
    expect(o.factors.some((f) => f.label === 'Cheaper listing sold out')).toBe(true);
  });
});

describe('nextSale', () => {
  it('finds the next sale event', () => {
    expect(nextSale(new Date('2026-10-20T00:00:00+05:30'))?.name).toBe('Diwali sales');
    expect(nextSale(new Date('2026-11-10T00:00:00+05:30'))?.name).toBe('Black Friday');
  });
});
