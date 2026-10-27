/** Shapes for GET /catalog/budget: the cheapest eligible offer per shoe, with the offers that store runs. Pure, so the rules are testable without a database. */

export interface BudgetOffer {
  kind: string;
  text: string;
  code: string | null;
  conditions: string | null;
  seenAt: string | null;
  source: string | null;
}

export interface BudgetItem {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  size: number;
  /** What the shopper pays in rupees: price plus shipping, the same figure the price page ranks by. */
  priceInr: number;
  shippingCost: number;
  store: { slug: string; name: string };
  listingUrl: string;
  fetchedAt: string;
  offers: BudgetOffer[];
  offersUpdatedAt: string | null;
}

export const BUDGET_LIMITS = { defaultMax: 5000, minMax: 500, maxMax: 1_000_000, defaultLimit: 12, maxLimit: 48 };
const MAX_OFFERS = 8;
const str = (v: unknown, cap: number): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, cap) : null);

/** The store's own offers as the price page shows them, keeping only what the shelf needs. Entries without text are dropped; nothing is invented. */
export function budgetOffers(raw: unknown): BudgetOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: BudgetOffer[] = [];
  for (const o of raw) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    const text = str(r.text, 300);
    if (!text) continue;
    out.push({ kind: str(r.kind, 30) ?? 'info', text, code: str(r.code, 60), conditions: str(r.conditions, 300), seenAt: str(r.seenAt, 40), source: str(r.source, 300) });
    if (out.length === MAX_OFFERS) break;
  }
  return out;
}

export function clampBudgetParams(max: unknown, limit: unknown): { max: number; limit: number } {
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = typeof v === 'string' || typeof v === 'number' ? Math.floor(Number(v)) : NaN;
    return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d;
  };
  return {
    max: num(max, BUDGET_LIMITS.defaultMax, BUDGET_LIMITS.minMax, BUDGET_LIMITS.maxMax),
    limit: num(limit, BUDGET_LIMITS.defaultLimit, 1, BUDGET_LIMITS.maxLimit),
  };
}

export function toBudgetItem(r: Record<string, unknown>): BudgetItem {
  const iso = (v: unknown) => (v ? new Date(v as string | Date).toISOString() : null);
  return {
    styleCode: String(r.style_code),
    brand: String(r.brand),
    model: String(r.model),
    colorway: String(r.colorway),
    primaryImageUrl: (r.primary_image_url as string | null) ?? null,
    size: Number(r.size),
    priceInr: Math.round(Number(r.eff)),
    shippingCost: Math.round(Number(r.shipping_cost ?? 0)),
    store: { slug: String(r.slug), name: String(r.store_name) },
    listingUrl: String(r.listing_url),
    fetchedAt: iso(r.fetched_at) as string,
    offers: budgetOffers(r.offers),
    offersUpdatedAt: iso(r.offers_updated_at),
  };
}
