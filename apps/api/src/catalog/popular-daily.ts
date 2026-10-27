/**
 * The nightly fill of popular_daily (migration 0052): per day (India time) and shoe, how many views and Buy clicks offer_events recorded.
 * Counts only. Idempotent: running a day again recomputes it from the events, so a late or repeated run changes nothing wrong.
 * Pure of any connection (it takes a query function), so the rule is testable; fill-popular-daily.ts runs it with a real pool.
 */
export const POPULAR_FILL_DAYS = { min: 1, max: 120, default: 3 };

export const POPULAR_FILL_SQL = `
INSERT INTO popular_daily (day, style_code, views, clicks)
SELECT (e.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, e.style_code,
       count(*) FILTER (WHERE e.event = 'view')::int,
       count(*) FILTER (WHERE e.event = 'click')::int
FROM offer_events e
WHERE e.created_at >= ((now() AT TIME ZONE 'Asia/Kolkata')::date - ($1::int - 1)) AT TIME ZONE 'Asia/Kolkata'
GROUP BY 1, 2
ON CONFLICT (day, style_code) DO UPDATE SET views = EXCLUDED.views, clicks = EXCLUDED.clicks`;

export function clampFillDays(days: unknown): number {
  const n = typeof days === 'string' || typeof days === 'number' ? Math.floor(Number(days)) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(n, POPULAR_FILL_DAYS.min), POPULAR_FILL_DAYS.max) : POPULAR_FILL_DAYS.default;
}

/** Fills today and the days before it (`days` days in all, default 3, so yesterday is settled and today is current). Returns the rows written. */
export async function fillPopularDaily(
  query: (text: string, params: unknown[]) => Promise<{ rowCount: number | null }>,
  days: unknown = POPULAR_FILL_DAYS.default,
): Promise<{ days: number; rows: number }> {
  const d = clampFillDays(days);
  const res = await query(POPULAR_FILL_SQL, [d]);
  return { days: d, rows: res.rowCount ?? 0 };
}
