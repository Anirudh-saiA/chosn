/**
 * Day 28 task 4 — "confirm the size-conversion lookup table from Day 8
 * covers any new regions/brands." No such table existed before this
 * (checked: `sneaker_variants.size_system` is stored per-row exactly as
 * the source retailer reported it — Day 1 §03's "the source system is
 * recorded rather than rewritten" — and nothing ever converted between
 * systems). This is a real gap Day 28 exposed rather than something Day
 * 8 already covered.
 *
 * Scope for this expansion: every new model added Day 28 keeps the same
 * launch convention — UK sizing, India region (Day 1 §03: "Indian
 * retailers list UK") — so no new region/brand actually required a live
 * conversion this round. This table exists so the *next* expansion that
 * does introduce one (a US-labeled source, a brand that lists EU only)
 * doesn't hit the same "nothing to convert with" gap again.
 *
 * Standard men's sneaker sizing — US/UK offset by 0.5, EU derived via
 * the common +33 (US) / +34 (UK) approximation used across Nike/adidas/
 * New Balance size charts. This is industry convention, not a CHOSN
 * invention, and deliberately doesn't attempt women's/GS/TD scales
 * (separate, non-linear tables) — sneakers.gender already distinguishes
 * those, and none of this expansion's new models are women's/kids-only
 * SKUs, so extending the table for them stays a "when needed."
 */

export type SizeSystem = 'us' | 'uk' | 'eu' | 'cm';

interface SizeRow {
  us: number;
  uk: number;
  eu: number;
  cm: number;
}

// US 6 - US 13, the range that actually covers real retailer listings
// for the models in this expansion (checked against each model's
// candidate titles — none list outside this band).
export const MENS_SIZE_CHART: SizeRow[] = [
  { us: 6, uk: 5.5, eu: 38.5, cm: 24 },
  { us: 6.5, uk: 6, eu: 39, cm: 24.5 },
  { us: 7, uk: 6, eu: 40, cm: 25 },
  { us: 7.5, uk: 6.5, eu: 40.5, cm: 25.5 },
  { us: 8, uk: 7, eu: 41, cm: 26 },
  { us: 8.5, uk: 7.5, eu: 42, cm: 26.5 },
  { us: 9, uk: 8, eu: 42.5, cm: 27 },
  { us: 9.5, uk: 8.5, eu: 43, cm: 27.5 },
  { us: 10, uk: 9, eu: 44, cm: 28 },
  { us: 10.5, uk: 9.5, eu: 44.5, cm: 28.5 },
  { us: 11, uk: 10, eu: 45, cm: 29 },
  { us: 11.5, uk: 10.5, eu: 45.5, cm: 29.5 },
  { us: 12, uk: 11, eu: 46, cm: 30 },
  { us: 13, uk: 12, eu: 47.5, cm: 31 },
];

/**
 * Nearest-match, not exact-or-throw: retailer-reported sizes occasionally
 * land off the standard grid (a half-size a chart doesn't list), and a
 * price page showing "closest known size" beats a hard failure blocking
 * that variant entirely. Returns null only for a size wildly outside any
 * real adult sneaker range (guards against a unit mix-up, e.g. someone
 * passing a UK size into the `us` slot).
 */
export function convertSize(size: number, from: SizeSystem, to: SizeSystem): number | null {
  if (from === to) return size;
  if (size < 3 || size > 20) return null;

  let closest: SizeRow | undefined;
  let closestDelta = Infinity;
  for (const row of MENS_SIZE_CHART) {
    const delta = Math.abs(row[from] - size);
    if (delta < closestDelta) {
      closest = row;
      closestDelta = delta;
    }
  }
  return closest ? closest[to] : null;
}
