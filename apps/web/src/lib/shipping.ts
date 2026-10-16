import { formatInr, type CatalogOffer } from './catalog';

export interface ShippingInfo {
  /** The big word on the card. */
  label: string;
  tone: 'good' | 'warn' | 'unknown';
  /** True only when the store's own rule says this order ships free. */
  free: boolean;
}

/**
 * Shipping for this order. The scraped price lists don't carry shipping, so a stored ₹0 means "unknown", not "free".
 * What can be said comes from the store's own stated rule ("Free shipping on orders above ₹9,999 (₹150 below that)").
 */
export function shippingInfo(o: Pick<CatalogOffer, 'shippingCost' | 'shippingNote' | 'effectivePriceInr'>): ShippingInfo {
  const note = o.shippingNote ?? '';
  const above = /free shipping on orders above\s*₹?\s*([\d,]+)/i.exec(note);
  const fee = /₹\s*([\d,]+)\s*below/i.exec(note);
  if (above) {
    const threshold = Number((above[1] ?? '').replace(/,/g, ''));
    if ((o.effectivePriceInr ?? 0) >= threshold) return { label: 'Free', tone: 'good', free: true };
    return { label: fee ? `${formatInr(Number((fee[1] ?? '').replace(/,/g, '')))} charge` : 'Charge applies', tone: 'warn', free: false };
  }
  if (o.shippingCost > 0) return { label: formatInr(o.shippingCost), tone: 'warn', free: false };
  return { label: 'Not stated', tone: 'unknown', free: false };
}
