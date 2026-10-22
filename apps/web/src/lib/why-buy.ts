import { formatInr, type CatalogOffer } from './catalog';
import { deliveryDays, formatDelivery, isEligible } from './recommend';
import { shippingInfo } from './shipping';

export interface WhyBuy {
  /** Real, checkable reasons to buy from this store (shown with a green tick). */
  good: string[];
  /** Things to know before buying (shown in red). */
  caution: string[];
  isCheapest: boolean;
  isFastest: boolean;
}

/**
 * "Why buy from here" for one store, compared with the other stores selling the same shoe in the same size.
 * Every line comes from data we hold: the price, the store's own delivery estimate, shipping, payment methods,
 * live offers and return rule. Nothing about reviews: no readable source exists, so none is claimed.
 */
export function whyBuy(offer: CatalogOffer, all: CatalogOffer[]): WhyBuy {
  const pool = all.filter(isEligible);
  const price = (o: CatalogOffer) => o.effectivePriceInr as number;
  const cheapest = pool.reduce((a, b) => (price(b) < price(a) ? b : a), pool[0] as CatalogOffer);
  const known = pool.filter((o) => deliveryDays(o) !== null);
  const fastest = known.length > 1 ? known.reduce((a, b) => ((deliveryDays(b) as number) < (deliveryDays(a) as number) ? b : a)) : null;
  const slowest = known.length > 1 ? known.reduce((a, b) => ((deliveryDays(b) as number) > (deliveryDays(a) as number) ? b : a)) : null;

  const isCheapest = pool.length > 1 && cheapest.retailerSlug === offer.retailerSlug;
  const isFastest = !!fastest && fastest.retailerSlug === offer.retailerSlug;
  const good: string[] = [];
  const caution: string[] = [];

  if (isCheapest) good.push(`Lowest price of the ${pool.length} stores`);
  else if (pool.length > 1 && price(offer) - price(cheapest) <= price(cheapest) * 0.03) good.push(`Only ${formatInr(price(offer) - price(cheapest))} above the lowest price`);

  const delivery = formatDelivery(offer);
  if (isFastest && delivery) good.push(`Fastest delivery: ${delivery}`);
  else if (slowest && slowest.retailerSlug === offer.retailerSlug && fastest) {
    const gap = Math.round((deliveryDays(offer) as number) - (deliveryDays(fastest) as number));
    if (gap >= 3) caution.push(`About ${gap} days slower than ${fastest.retailerName}`);
  }

  if (shippingInfo(offer).free) good.push('Free shipping on this order');
  // `?? []`: cached pages from before these fields existed simply have no payment / offer data.
  const methods = offer.paymentMethods ?? [];
  const offers = offer.offers ?? [];
  if (methods.includes('Cash on delivery')) good.push('Pay on delivery is available');
  else if (methods.length >= 4) good.push('Many ways to pay, including UPI and cards');
  if (offers.length > 0) good.push(`Offer running: ${offers[0]!.text}`);
  if (offer.returnsTone === 'ok' && offer.returnsNote) good.push(offer.returnsNote);

  if (offer.returnsTone === 'none' && offer.returnsNote) caution.push(offer.returnsNote);
  if (!isCheapest && pool.length > 1 && price(offer) - price(cheapest) > price(cheapest) * 0.1) {
    caution.push(`${formatInr(price(offer) - price(cheapest))} more than ${cheapest.retailerName}`);
  }

  return { good: good.slice(0, 4), caution: caution.slice(0, 2), isCheapest, isFastest };
}
