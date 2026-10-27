import { describe, expect, it } from 'vitest';
import { POPULAR_FILL_DAYS, POPULAR_FILL_SQL, clampFillDays, fillPopularDaily } from './popular-daily';
import { budgetRanking, clampTrendingDays } from './budget';

describe('popular_daily nightly fill', () => {
  it('groups offer_events by India-time day and shoe, counting views and Buy clicks, and rewrites a day on re-run', () => {
    expect(POPULAR_FILL_SQL).toContain('FROM offer_events');
    expect(POPULAR_FILL_SQL).toContain("AT TIME ZONE 'Asia/Kolkata'");
    expect(POPULAR_FILL_SQL).toContain("count(*) FILTER (WHERE e.event = 'view')");
    expect(POPULAR_FILL_SQL).toContain("count(*) FILTER (WHERE e.event = 'click')");
    expect(POPULAR_FILL_SQL).toContain('ON CONFLICT (day, style_code) DO UPDATE SET views = EXCLUDED.views, clicks = EXCLUDED.clicks');
    expect(POPULAR_FILL_SQL).not.toMatch(/visitor_id|retailer_slug/); // counts only, nothing personal
  });

  it('runs one statement for the last 3 days by default and reports the rows', async () => {
    const calls: Array<[string, unknown[]]> = [];
    const out = await fillPopularDaily(async (text, params) => (calls.push([text, params]), { rowCount: 7 }));
    expect(out).toEqual({ days: 3, rows: 7 });
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual([3]);
  });

  it('clamps the number of days to 1..120 and ignores junk', () => {
    expect(clampFillDays(0)).toBe(POPULAR_FILL_DAYS.min);
    expect(clampFillDays('9999')).toBe(POPULAR_FILL_DAYS.max);
    expect(clampFillDays('abc')).toBe(POPULAR_FILL_DAYS.default);
    expect(clampFillDays('90')).toBe(90);
    expect(clampFillDays(undefined)).toBe(3);
  });
});

describe('trending helpers', () => {
  it('clampTrendingDays keeps 1 to 7', () => {
    expect(clampTrendingDays(undefined)).toBe(7);
    expect(clampTrendingDays('0')).toBe(1);
    expect(clampTrendingDays(30)).toBe(7);
    expect(clampTrendingDays('3')).toBe(3);
  });
  it('budgetRanking falls back to store count when nobody has traffic', () => {
    expect(budgetRanking('trending', [{ trendScore: 0 }, { trendScore: 0 }])).toBe('stores');
    expect(budgetRanking('trending', [])).toBe('stores');
    expect(budgetRanking('trending', [{ trendScore: 0 }, { trendScore: 4 }])).toBe('trending');
    expect(budgetRanking('popular', [{ trendScore: 9 }])).toBe('stores');
    expect(budgetRanking('cheapest', [{ trendScore: 9 }])).toBe('price');
  });
});
