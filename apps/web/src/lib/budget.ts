/** GET /catalog/budget (Back end): each shoe's cheapest eligible offer at or under a price, with the offers that store lists, in one call. */

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
  /** What the shopper pays in rupees: price plus shipping, the figure the price page ranks by. */
  priceInr: number;
  shippingCost: number;
  store: { slug: string; name: string };
  listingUrl: string;
  fetchedAt: string;
  offers: BudgetOffer[];
  offersUpdatedAt: string | null;
  /** How many different stores have this shoe eligible right now. */
  storeCount: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The shoes under `max` rupees, best first. `sort` is the API's ranking: 'popular' today (sold at the most stores, 2 or more). When Back end adds a
 * ranking by each day's views and Buy clicks, only RANKING in BudgetShelf.tsx changes.
 * The API can return the same model in several colourways; we ask for more than we need and keep the first of each model.
 */
export async function fetchBudget(max: number, sort: string, want: number, init?: RequestInit): Promise<BudgetItem[]> {
  const res = await fetch(`${API_URL}/catalog/budget?max=${max}&sort=${encodeURIComponent(sort)}&limit=${Math.min(want * 3, 48)}`, init);
  if (!res.ok) throw new Error(`budget fetch failed: ${res.status}`);
  const body = (await res.json()) as { items: BudgetItem[] };
  const seen = new Set<string>();
  const out: BudgetItem[] = [];
  for (const it of body.items) {
    const key = `${it.brand}|${it.model}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length === want) break;
  }
  return out;
}
