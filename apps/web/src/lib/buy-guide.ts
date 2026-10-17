import { formatInr, type CatalogOffer, type StoreOffer } from './catalog';
import { deliveryDays, formatDelivery, isEligible } from './recommend';
import { shippingInfo } from './shipping';

export interface GuideStep {
  title: string;
  /** Extra lines under the step (each one a plain fact from the store). */
  lines: string[];
}

export interface BuyGuide {
  best: CatalogOffer;
  price: number;
  steps: GuideStep[];
  /** The biggest single "up to" saving the store lists (cashback, coupon), or 0. Never added to the price: it is conditional. */
  maxExtraSaving: number;
  /** False when none of the stores publishes a bank or card offer (they live behind each store's checkout). */
  anyBankOrCardOffer: boolean;
}

const SAVING_KINDS = new Set(['coupon', 'bank', 'card', 'wallet', 'credit']);

/** "Pay with UPI, net banking, cards ..." from the store's own payment groups; falls back to the flat method list. */
export function acceptedPayments(o: CatalogOffer): string[] {
  const groups = (o.paymentOptions ?? []).filter((g) => !g.unavailable && g.items.length > 0);
  if (groups.length > 0) return groups.map((g) => g.label);
  return o.paymentMethods ?? [];
}

function offerLine(o: StoreOffer): string {
  if (o.kind === 'coupon' && o.code) return `Use code ${o.code}: ${o.text}`;
  return o.text;
}

/**
 * How to buy this exact shoe, in this size, for the least money. Only facts the stores publish: the lowest total
 * price, any faster option worth knowing about, how you can pay, and every coupon / bank / wallet offer the cheapest
 * store lists. Savings that depend on a condition are shown as "up to", never subtracted from the price.
 */
export function buildBuyGuide(offers: CatalogOffer[]): BuyGuide | null {
  const pool = offers.filter(isEligible);
  if (pool.length === 0) return null;
  const price = (o: CatalogOffer) => o.effectivePriceInr as number;
  const days = (o: CatalogOffer) => deliveryDays(o) ?? 99;
  const best = [...pool].sort((a, b) => price(a) - price(b) || days(a) - days(b))[0] as CatalogOffer;

  const steps: GuideStep[] = [];

  // 1. Where to buy
  const ship = shippingInfo(best);
  const one: string[] = [];
  if (ship.free) one.push('Free shipping on this order');
  else if (ship.tone === 'warn') one.push(`Shipping ${ship.label.toLowerCase()}`);
  const eta = formatDelivery(best);
  if (eta) one.push(`Delivery in ${eta}`);
  steps.push({ title: `Buy at ${best.retailerName} for ${formatInr(price(best))}`, lines: one });

  // 2. A faster option, only when it matters
  const faster = pool
    .filter((o) => o.retailerSlug !== best.retailerSlug && deliveryDays(o) !== null && deliveryDays(best) !== null && (deliveryDays(best) as number) - (deliveryDays(o) as number) >= 3)
    .sort((a, b) => days(a) - days(b))[0];
  if (faster) {
    const extra = price(faster) - price(best);
    steps.push({
      title: `Need it sooner? ${faster.retailerName} delivers in ${formatDelivery(faster)}`,
      lines: [extra > 0 ? `${formatInr(extra)} more than ${best.retailerName}` : `Same price or less than ${best.retailerName}`],
    });
  }

  // 3. How to pay
  const methods = acceptedPayments(best);
  if (methods.length > 0) steps.push({ title: `Pay with ${methods.join(', ')}`, lines: [] });

  // 4. Savings the store lists
  const saves = (best.offers ?? []).filter((o) => SAVING_KINDS.has(o.kind));
  if (saves.length > 0) steps.push({ title: 'Take the offers the store lists', lines: saves.map(offerLine) });

  const maxExtraSaving = Math.max(0, ...saves.map((o) => o.upTo ?? 0));
  const anyBankOrCardOffer = pool.some((o) => (o.offers ?? []).some((x) => x.kind === 'bank' || x.kind === 'card'));
  return { best, price: price(best), steps, maxExtraSaving, anyBankOrCardOffer };
}
