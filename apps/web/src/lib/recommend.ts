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
