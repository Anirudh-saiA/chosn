import { formatInr, type CatalogOffer } from './catalog';

/**
 * "Which store should I buy this exact shoe from?" — one pick, with the reasons spelled out.
 *
 * Only real, fresh, in-stock offers compete (never the demo/fixture ones). Each is scored on:
 *   price  (total incl. shipping)  — a store 20% or more above the cheapest scores 0 here
 *   delivery (store's published days) — 6+ days slower than the fastest scores 0; unknown scores a little below average
 *   rating (only if a store has a cited rating) — 3★ scores 0, 5★ scores 1
 * Weights: price 70 / delivery 30, or 55 / 25 / 20 once any rating exists. The score is only used to choose;
 * what the shopper reads are the plain reasons, so the pick can always be checked by eye.
 */

export interface BestPick {
  offer: CatalogOffer;
  /** Plain-language reasons this store was chosen. */
  reasons: string[];
  /** Other stores worth a look: the cheapest and the fastest, when they are not the pick. */
  alternatives: Array<{ offer: CatalogOffer; why: string }>;
  usedRatings: boolean;
  competing: number;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export const isEligible = (o: CatalogOffer) => o.mode !== 'fixture' && o.inStock && !o.isStale && o.effectivePriceInr !== null;

export const deliveryDays = (o: CatalogOffer): number | null =>
  o.deliveryMinDays != null && o.deliveryMaxDays != null ? (o.deliveryMinDays + o.deliveryMaxDays) / 2 : null;

export function formatDelivery(o: Pick<CatalogOffer, 'deliveryMinDays' | 'deliveryMaxDays'>): string | null {
  if (o.deliveryMinDays == null || o.deliveryMaxDays == null) return null;
  return o.deliveryMinDays === o.deliveryMaxDays ? `${o.deliveryMinDays} days` : `${o.deliveryMinDays}–${o.deliveryMaxDays} days`;
}

export interface ValueScore {
  /** 0-100: how good a place to buy this is, counting price, delivery time, returns and (where a store has them) reviews. */
  score: number;
  price: number;
  delivery: number;
  returns: number;
  rating: number | null;
  /** Plain-language breakdown for a tooltip. */
  note: string;
}

const RETURNS_SCORE: Record<string, number> = { ok: 1, limited: 0.5, none: 0 };

/**
 * The "Value score" for every eligible store, from facts only (nothing predicted):
 *   price     total incl. shipping; a store 25% or more above the cheapest scores 0
 *   delivery  the store's own published days; 8+ days slower than the fastest scores 0; not published = a little below average
 *   returns   the store's stated policy: accepted 1, limited 0.5, none 0, not stated 0.4
 *   reviews   only where a store has a cited rating (3 stars = 0, 5 stars = 1); otherwise left out and the weights re-balanced
 * Weights: price 55 / delivery 30 / returns 15, or price 45 / delivery 25 / returns 10 / reviews 20 once any store has a rating.
 */
export function scoreOffers(offers: CatalogOffer[]): Map<string, ValueScore> {
  const pool = offers.filter(isEligible);
  const out = new Map<string, ValueScore>();
  if (pool.length === 0) return out;
  const price = (o: CatalogOffer) => o.effectivePriceInr as number;
  const cheapest = Math.min(...pool.map(price));
  const days = pool.map(deliveryDays).filter((d): d is number => d !== null);
  const minDays = days.length > 0 ? Math.min(...days) : 0;
  const anyRating = pool.some((o) => o.rating != null);
  const w = anyRating ? { price: 0.45, delivery: 0.25, returns: 0.1, rating: 0.2 } : { price: 0.55, delivery: 0.3, returns: 0.15, rating: 0 };
  for (const o of pool) {
    const p = clamp(1 - (price(o) - cheapest) / (cheapest * 0.25));
    const d = deliveryDays(o) === null ? 0.4 : clamp(1 - ((deliveryDays(o) as number) - minDays) / 8);
    const r = o.returnsTone && o.returnsTone in RETURNS_SCORE ? (RETURNS_SCORE[o.returnsTone] as number) : 0.4;
    const rt = o.rating == null ? null : clamp((o.rating - 3) / 2);
    const score = Math.round(100 * (w.price * p + w.delivery * d + w.returns * r + (rt === null ? 0 : w.rating * rt) + (anyRating && rt === null ? w.rating * 0.4 : 0)));
    const parts = [`Price ${Math.round(p * 100)}`, `Delivery ${deliveryDays(o) === null ? 'not stated' : Math.round(d * 100)}`, `Returns ${o.returnsTone ? Math.round(r * 100) : 'not stated'}`];
    if (anyRating) parts.push(`Reviews ${rt === null ? 'none yet' : Math.round(rt * 100)}`);
    out.set(o.retailerSlug, { score, price: p, delivery: d, returns: r, rating: rt, note: `${parts.join(' · ')} (each out of 100)` });
  }
  return out;
}

export function pickBestToBuy(offers: CatalogOffer[]): BestPick | null {
  const pool = offers.filter(isEligible);
  if (pool.length === 0) return null;

  const price = (o: CatalogOffer) => o.effectivePriceInr as number;
  const cheapest = pool.reduce((a, b) => (price(b) < price(a) ? b : a));
  const known = pool.filter((o) => deliveryDays(o) !== null);
  const fastest = known.length > 0 ? known.reduce((a, b) => ((deliveryDays(b) as number) < (deliveryDays(a) as number) ? b : a)) : null;
  const anyRating = pool.some((o) => o.rating != null);

  if (pool.length === 1) {
    const only = pool[0] as CatalogOffer;
    return { offer: only, reasons: ['The only store with this size in stock right now'], alternatives: [], usedRatings: false, competing: 1 };
  }

  const w = anyRating ? { price: 0.55, delivery: 0.25, rating: 0.2 } : { price: 0.7, delivery: 0.3, rating: 0 };
  const minDays = fastest ? (deliveryDays(fastest) as number) : 0;
  const score = (o: CatalogOffer) => {
    const p = clamp(1 - (price(o) - price(cheapest)) / (price(cheapest) * 0.2));
    const d = deliveryDays(o) === null ? 0.4 : clamp(1 - ((deliveryDays(o) as number) - minDays) / 6);
    const r = o.rating == null ? 0.4 : clamp((o.rating - 3) / 2);
    return w.price * p + w.delivery * d + w.rating * r;
  };
  const pick = [...pool].sort((a, b) => score(b) - score(a) || price(a) - price(b))[0] as CatalogOffer;

  const reasons: string[] = [];
  const extra = price(pick) - price(cheapest);
  if (pick.retailerSlug === cheapest.retailerSlug) reasons.push(`Lowest total price (${formatInr(price(pick))})`);
  else reasons.push(`${formatInr(extra)} more than the cheapest (${cheapest.retailerName}), but the better overall deal`);

  const pickDelivery = formatDelivery(pick);
  if (pickDelivery) {
    const slower = known.filter((o) => (deliveryDays(o) as number) > (deliveryDays(pick) as number));
    if (fastest && fastest.retailerSlug === pick.retailerSlug && known.length > 1) reasons.push(`Fastest delivery of the stores listed (${pickDelivery})`);
    else if (slower.length > 0) reasons.push(`Delivers in ${pickDelivery}, sooner than ${slower.map((o) => o.retailerName).join(' and ')}`);
    else reasons.push(`Delivers in ${pickDelivery}`);
  } else {
    reasons.push('Delivery time not published by this store');
  }
  if (pick.rating != null) reasons.push(`Store rating ${pick.rating.toFixed(1)}★${pick.reviewCount ? ` from ${pick.reviewCount.toLocaleString('en-IN')} reviews` : ''}`);

  const alternatives: BestPick['alternatives'] = [];
  if (cheapest.retailerSlug !== pick.retailerSlug) alternatives.push({ offer: cheapest, why: `Cheapest (${formatInr(price(cheapest))})${formatDelivery(cheapest) ? `, delivers in ${formatDelivery(cheapest)}` : ''}` });
  if (fastest && fastest.retailerSlug !== pick.retailerSlug && fastest.retailerSlug !== cheapest.retailerSlug)
    alternatives.push({ offer: fastest, why: `Fastest (${formatDelivery(fastest)}), ${formatInr(price(fastest))}` });

  return { offer: pick, reasons, alternatives, usedRatings: anyRating, competing: pool.length };
}
