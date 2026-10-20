export type DropStatus = 'upcoming' | 'live' | 'sold_out';

export interface PurchaseLink {
  retailer_name?: string;
  url: string;
  region?: string;
}

export interface RaffleInfo {
  registration_url?: string;
  registration_closes_at?: string;
  method?: string;
}

/** Mirrors apps/api/src/drops/drops.controller.ts's DropEventSummary. */
export interface DropEventSummary {
  id: string;
  status: DropStatus;
  releaseDate: string;
  releaseTime: string | null;
  releaseTimezone: string;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  purchaseLinks: unknown;
  raffleInfo: unknown;
}

export interface DropSneakerSummary {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  /** Where a stored picture came from. */
  imageCredit?: string | null;
}

/** Mirrors DropsService.DropListItem. */
export type DropConfirmation = 'confirmed' | 'reported' | 'unconfirmed';

/** A drop's price, always in rupees; a converted price also says what it was listed at, e.g. "\u20B913,290 (listed $140)". */
export function formatDropPrice(d: { retailPrice: string | null; currency: string; retailPriceInr?: number | null; fxRate?: number | null }, withOriginal = false): string {
  if (d.retailPriceInr == null) return d.retailPrice ? formatMoney(Number(d.retailPrice), d.currency) : 'TBA';
  const inr = `\u20B9${d.retailPriceInr.toLocaleString('en-IN')}`;
  if (!d.fxRate) return inr;
  return withOriginal ? `${inr} (listed ${formatMoney(Number(d.retailPrice), d.currency)})` : `\u2248 ${inr}`;
}

/** A price in its own currency: rupees for India drops, dollars for the US trackers' dates. */
export function formatMoney(amount: number, currency: string): string {
  if (currency === 'INR') return `\u20B9${Math.round(amount).toLocaleString('en-IN')}`;
  if (currency === 'USD') return `$${Math.round(amount).toLocaleString('en-US')}`;
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
}

export interface DropListItem {
  id: string;
  /** The price in rupees (converted for drops listed in another currency). */
  retailPriceInr?: number | null;
  /** Rupees per unit of the listed currency when converted. */
  fxRate?: number | null;
  confirmation?: DropConfirmation;
  /** Who confirmed this drop and where to read it. */
  sourceName?: string | null;
  sourceUrl?: string | null;
  status: DropStatus;
  releaseDate: string;
  releaseTime: string | null;
  releaseTimezone: string;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  sneaker: DropSneakerSummary;
}

export interface RelatedNewsItem {
  id: string;
  title: string;
  publishedAt: string;
  isBreaking: boolean;
}

/** Mirrors DropsService.DropDetail. */
export interface DropDetail extends DropListItem {
  purchaseLinks: PurchaseLink[];
  raffleInfo: RaffleInfo | null;
  defaultVariant: { id: string; size: number; sizeSystem: string } | null;
  relatedNews: RelatedNewsItem[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Most sneakers have no drop_event at all — a 404-shaped "null" is the
 * normal case here, not an error. Never throws: called from the price
 * page's server render, where an API hiccup should mean "no drop
 * section shown," not a failed page — same defensive shape as
 * fetchAllVariantParams in lib/catalog.ts.
 */
export async function fetchDropForSneaker(
  styleCode: string,
  init?: RequestInit,
): Promise<DropEventSummary | null> {
  try {
    const res = await fetch(`${API_URL}/drops/by-style-code/${encodeURIComponent(styleCode)}`, init);
    if (!res.ok) return null;
    const body: DropEventSummary | null = await res.json();
    return body;
  } catch {
    return null;
  }
}

/** The calendar/list page's one data source (Day 15 task 1). Never throws — an empty array is a legitimate "no drops" state, not a failed page. */
export async function fetchDropsList(
  params: { from?: string; to?: string; status?: DropStatus[] } = {},
  init?: RequestInit,
): Promise<DropListItem[]> {
  try {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.status?.length) query.set('status', params.status.join(','));
    const qs = query.toString();
    const res = await fetch(`${API_URL}/drops${qs ? `?${qs}` : ''}`, init);
    if (!res.ok) return [];
    return (await res.json()) as DropListItem[];
  } catch {
    return [];
  }
}

/** Returns null on any failure (including a genuine 404) — the drop-detail page treats both as notFound(). */
export async function fetchDropDetail(id: string, init?: RequestInit): Promise<DropDetail | null> {
  try {
    const res = await fetch(`${API_URL}/drops/${encodeURIComponent(id)}`, init);
    if (!res.ok) return null;
    return (await res.json()) as DropDetail;
  } catch {
    return null;
  }
}

export function parsePurchaseLinks(raw: unknown): PurchaseLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l): l is PurchaseLink => typeof l === 'object' && l !== null && typeof (l as PurchaseLink).url === 'string');
}

export function parseRaffleInfo(raw: unknown): RaffleInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  return raw as RaffleInfo;
}

const REGION_LABELS: Record<string, string> = { india: 'India', us: 'US', global: 'Global' };

export function formatRegions(regions: string[]): string {
  if (regions.length === 0) return '';
  const labels = regions.map((r) => REGION_LABELS[r] ?? r);
  if (labels.length === 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1] ?? ''}`;
}

/** `13:04:48` -> `1:04 PM`. `null` (TBA) is the caller's concern, not this formatter's. */
export function formatReleaseTime(time: string): string {
  const [h = '0', m = '0'] = time.split(':');
  const hour = Number(h);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${period}`;
}
