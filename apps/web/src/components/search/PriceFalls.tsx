import { DealsTabs, type Deal } from './DealsTabs';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface PriceDrop {
  styleCode: string;
  brand: string;
  model: string;
  primaryImageUrl: string | null;
  size: number;
  previousPrice: number;
  currentPrice: number;
  dropPct: number;
  store: string;
  previousDay: string;
}
interface StoreDiscount {
  styleCode: string;
  brand: string;
  model: string;
  primaryImageUrl: string | null;
  size: number;
  wasPrice: number;
  price: number;
  discountPct: number;
  store: string;
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

async function get<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 600 } });
    return res.ok ? ((await res.json()) as T[]) : [];
  } catch {
    return [];
  }
}

/** Real price cuts since the previous recorded day (the same store lowered its price). */
export async function fetchFalls(limit: number): Promise<Deal[]> {
  const rows = await get<PriceDrop>(`/catalog/price-drops?limit=${limit}`);
  return rows.map((d) => ({
    key: `fall-${d.styleCode}-${d.size}`,
    styleCode: d.styleCode,
    brand: d.brand,
    model: d.model,
    image: d.primaryImageUrl,
    size: d.size,
    store: d.store,
    now: d.currentPrice,
    was: d.previousPrice,
    pct: d.dropPct,
    note: `was this on ${day(d.previousDay)}`,
  }));
}

/** Discounts against the store's own listed "was" price. */
export async function fetchSale(limit: number): Promise<Deal[]> {
  const rows = await get<StoreDiscount>(`/catalog/discounts?limit=${limit}`);
  return rows.map((d) => ({
    key: `sale-${d.styleCode}-${d.size}`,
    styleCode: d.styleCode,
    brand: d.brand,
    model: d.model,
    image: d.primaryImageUrl,
    size: d.size,
    store: d.store,
    now: d.price,
    was: d.wasPrice,
    pct: d.discountPct,
    note: "store's listed price",
  }));
}

/**
 * "Crazy falls" strip for the Compare page: tab one is price cuts since yesterday (from our recorded history), tab two is discounts
 * against the store's own "was" price. Hidden when both are empty, so it never shows filler.
 */
export async function PriceFalls() {
  const [falls, sale] = await Promise.all([fetchFalls(8), fetchSale(8)]);
  if (falls.length === 0 && sale.length === 0) return null;
  return <DealsTabs falls={falls} sale={sale} />;
}
