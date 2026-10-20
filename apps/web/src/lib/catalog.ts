/**
 * Types and helpers for the price comparison page (Day 10). The shapes
 * here are hand-kept in sync with apps/api/src/catalog — there is no
 * shared types package for a single page's data, matching how
 * WaitlistForm already talks to the API with its own local types rather
 * than a generated client.
 */

export type Signal = 'good_time_to_buy' | 'neutral' | 'consider_waiting' | 'insufficient_data';

export interface MarketIntelligence {
  sneakerVariantId: string;
  currentPrice: number | null;
  currentRetailerId: string | null;
  currentRetailerSlug: string | null;
  bestAvailablePrice: number | null;
  bestRetailerId: string | null;
  bestRetailerSlug: string | null;
  avg30d: number | null;
  avg90d: number | null;
  trendPct: number | null;
  signal: Signal | null;
  daysHistory30d: number;
  daysHistory90d: number;
  sufficientData: boolean;
  currency: string;
  computedAt: string;
}

/** One offer a store runs. kind: sale | coupon | bank | card | wallet | emi | shipping | credit | info. */
export interface StoreOffer {
  kind: string;
  text: string;
  code?: string;
  bank?: string;
  upTo?: number;
  conditions?: string;
  url?: string;
  source?: string;
  seenAt?: string;
}

/** A group of ways to pay (UPI, cards, wallets ...) exactly as the store shows them. */
export interface PaymentGroup {
  kind: string;
  label: string;
  items: string[];
  note?: string;
  unavailable?: boolean;
  source?: string;
  seenAt?: string;
}

export interface CatalogOffer {
  retailerSlug: string;
  retailerName: string;
  retailerLogoUrl: string | null;
  price: number;
  shippingCost: number;
  currency: string;
  effectivePriceInr: number | null;
  condition: string;
  inStock: boolean;
  listingUrl: string;
  /** This retailer's own listing photo — the fallback tier resolve-sneaker-image.ts reads. Null more often than not; see its own comment. */
  imageUrl: string | null;
  fetchedAt: string;
  fetchFrequencyMinutes: number;
  /** The store's own published delivery estimate in days (null = not published). */
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  deliveryNote: string | null;
  deliverySourceUrl: string | null;
  /** Store rating — only ever set from a cited source; null = no review data. */
  rating: number | null;
  reviewCount: number | null;
  ratingSource: string | null;
  ratingUrl: string | null;
  /** The store's Trust score (0-100), how much evidence is behind it, and the working. Null until computed. */
  trustScore?: number | null;
  trustConfidence?: 'high' | 'medium' | 'low' | null;
  trustDetail?: { parts: Record<string, number>; why: string[]; sources: Array<{ title: string; url: string }>; formula: string; computed: string } | null;
  /** Payment methods the store says it accepts; empty = the store doesn't say (nothing is shown). */
  paymentMethods: string[];
  shippingNote: string | null;
  returnsNote: string | null;
  /** 'ok' | 'limited' | 'none' */
  returnsTone: string | null;
  infoSourceUrl: string | null;
  /** Live offers read from the store's own site, plus the ones checked by hand. */
  offers: StoreOffer[];
  /** Every way to pay, grouped. Cached pages from before this field existed have none. */
  paymentOptions?: PaymentGroup[];
  offersUpdatedAt: string | null;
  isStale: boolean;
  /** 'fixture' = placeholder data, not a real quote — see OfferTable's disclosure. */
  mode: 'live' | 'fixture' | 'manual';
}

export interface CatalogSneaker {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  silhouette: string | null;
  gender: string;
  primaryImageUrl: string | null;
  /** Other angles of the same pair; empty when only the primary photo is known. */
  galleryImageUrls?: string[];
}

export interface CatalogVariant {
  id: string;
  size: number;
  sizeSystem: string;
  region: string;
}

export interface SiblingSize {
  size: number;
  sizeSystem: string;
  /** At least one connected store has this size in stock right now (undefined from an older API: treat as available). */
  available?: boolean;
}

export interface CatalogResponse {
  sneaker: CatalogSneaker;
  variant: CatalogVariant;
  siblingSizes: SiblingSize[];
  /** Every store CHOSN reads prices from. */
  connectedStores?: Array<{ slug: string; name: string }>;
  offers: CatalogOffer[];
  marketIntelligence: MarketIntelligence | null;
  /** Buy now / Wait outlook for this shoe in this size (apps/api price-outlook.ts). */
  outlook?: PriceOutlook | null;
}

export interface PriceOutlook {
  verdict: 'buy_now' | 'wait' | 'fair' | 'unclear';
  headline: string;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  factors: Array<{ label: string; effect: 'buy' | 'wait' | 'info'; detail: string; points: number }>;
  peerDropShare: number | null;
  peerCount: number;
  peerWindowDays: number;
  historyDays: number;
  model: string;
}

/** One colourway of a model (mirrors apps/api catalog.service ColourOption). */
export interface ColourOption {
  styleCode: string;
  colorway: string;
  primaryImageUrl: string | null;
  defaultSize: number;
  /** UK sizes this colourway has in stock. */
  sizesInStock: number[];
  bestAvailablePrice: number | null;
  /** The shoe the page is about. */
  current: boolean;
}

export interface SearchResultItem {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  silhouette: string | null;
  primaryImageUrl: string | null;
  defaultSize: number;
  defaultSizeSystem: string;
  currentPrice: number | null;
  bestAvailablePrice: number | null;
  signal: Signal | null;
  currency: string;
  /** How many real stores have this shoe in stock (search results only). */
  storeCount?: number;
  /** Search results: the stores that have this shoe in stock, A to Z. */
  storeNames?: string[];
  /** Search results: every matching colourway of this model, the shown one first (one card per model). */
  colours?: Array<Pick<ColourOption, 'styleCode' | 'colorway' | 'primaryImageUrl' | 'defaultSize' | 'bestAvailablePrice'> & { sizes?: number[]; storeSlugs?: string[]; sizeList?: Array<{ size: number; available: boolean }>; offers?: Array<{ slug: string; price: number; inStock: boolean; wasPrice: number | null }> }>;
  /** Only on similar-sneaker results: same model in another colourway. */
  sameModel?: boolean;
  /** Only on similar-sneaker results: cheapest in-stock store and its direct listing link. */
  bestRetailerName?: string;
  listingUrl?: string;
}

export interface CommunityPostSearchResult {
  id: string;
  postType: string;
  title: string | null;
  preview: string;
  authorDisplayName: string | null;
  createdAt: string;
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface SearchFacets {
  brands: FacetOption[];
  stores: Array<{ slug: string; name: string; count: number }>;
  colors: FacetOption[];
  price: { min: number; max: number; p98: number };
}

export interface SearchResponse {
  results: SearchResultItem[];
  /** Name and logo of every live store. */
  storeDirectory?: Array<{ slug: string; name: string; logoUrl: string | null }>;
  total: number;
  brands: string[];
  facets: SearchFacets;
  communityPosts: CommunityPostSearchResult[];
}

export interface SearchQuery {
  q?: string;
  /** Comma-separated lists for brand / store / color. */
  brand?: string;
  store?: string;
  color?: string;
  minPrice?: string;
  maxPrice?: string;
  minStores?: string;
  soldOut?: string;
  sort?: string;
  signal?: string;
  /** UK size: only shoes in stock in this size, priced for it. */
  size?: string;
  /** Page number (1-based); the browse page turns it into limit + offset for the API. */
  page?: string;
  limit?: string;
  offset?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Server-side search/browse (Day 11) — query params drive the filter, same endpoint either way. */
export async function fetchSearch(query: SearchQuery, init?: RequestInit): Promise<SearchResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }

  const res = await fetch(`${API_URL}/catalog/search?${params.toString()}`, init);
  if (!res.ok) throw new Error(`search fetch failed: ${res.status}`);
  return res.json() as Promise<SearchResponse>;
}

/**
 * Build-time only — feeds generateStaticParams() on the price
 * comparison page so every launch-catalog variant is pre-rendered
 * instead of every request re-rendering on demand (Day 11's load test
 * finding, see load-tests/run-report.md). No `next: { revalidate }`
 * here deliberately: this runs once during `next build`, not per
 * request, so there's no request-time cache to configure.
 *
 * Must never throw. generateStaticParams() has no error boundary of
 * its own — an uncaught rejection here fails `next build` outright, not
 * just this one page, and returning zero paths is always a safe
 * fallback: dynamicParams defaults to true, so every variant still
 * renders correctly on its first real request, on demand, exactly like
 * before this optimization existed. The `!res.ok` check alone wasn't
 * enough — a connection failure (wrong/missing NEXT_PUBLIC_API_URL at
 * build time, the API briefly unreachable) rejects the fetch() promise
 * itself rather than resolving with a bad status, and that rejection
 * was propagating uncaught until this failed a real Vercel build.
 */
export async function fetchAllVariantParams(): Promise<{ styleCode: string; size: number }[]> {
  try {
    const res = await fetch(`${API_URL}/catalog/variants`);
    if (!res.ok) return [];
    return (await res.json()) as { styleCode: string; size: number }[];
  } catch (err) {
    console.warn(`generateStaticParams: could not reach ${API_URL}/catalog/variants — building with zero pre-rendered variants (they still work on demand). ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetches one variant's full page data. Used both server-side (page.tsx,
 * with Next's `revalidate` cache option) and client-side (the size
 * switcher's prefetch/swap, uncached) — the caller decides caching, this
 * just knows the URL shape and how to surface a 404 vs a real error.
 */
export async function fetchCatalogVariant(
  styleCode: string,
  size: number,
  init?: RequestInit,
): Promise<CatalogResponse | null> {
  const res = await fetch(`${API_URL}/catalog/${encodeURIComponent(styleCode)}/${size}`, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  return res.json() as Promise<CatalogResponse>;
}

/** One shoe in the side-by-side compare view (mirrors apps/api catalog.service CompareItem). */
export interface CompareItem {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  bestPrice: number | null;
  bestRetailerName: string | null;
  sizesInStock: number[];
  linkSize: number | null;
  offers: Array<{
    retailerSlug: string;
    retailerName: string;
    bestPrice: number;
    listingUrl: string;
    sizesInStock: number[];
  }>;
}

/** Shoes similar to `styleCode` (other colourways, then the brand's closest models) that are in stock somewhere. */
export async function fetchSimilar(styleCode: string, init?: RequestInit): Promise<SearchResultItem[]> {
  try {
    const res = await fetch(`${API_URL}/catalog/${encodeURIComponent(styleCode)}/similar?limit=14`, init);
    if (!res.ok) return [];
    return ((await res.json()) as { results: SearchResultItem[] }).results;
  } catch {
    return []; // the rail is an extra — never fail the page over it
  }
}

/** The model's colourways, this shoe first (empty when the API can't be reached - the picker just hides). */
export async function fetchColours(styleCode: string, init?: RequestInit): Promise<ColourOption[]> {
  try {
    const res = await fetch(`${API_URL}/catalog/${encodeURIComponent(styleCode)}/colours`, init);
    if (!res.ok) return [];
    return ((await res.json()) as { colours: ColourOption[] }).colours;
  } catch {
    return [];
  }
}

/** Up to four shoes side by side, in the order requested. */
export async function fetchCompare(styleCodes: string[], init?: RequestInit): Promise<CompareItem[]> {
  if (styleCodes.length === 0) return [];
  const res = await fetch(`${API_URL}/catalog/compare?styles=${encodeURIComponent(styleCodes.join(','))}`, init);
  if (!res.ok) throw new Error(`compare fetch failed: ${res.status}`);
  return ((await res.json()) as { items: CompareItem[] }).items;
}

/** en-IN grouping (lakh/crore boundaries) — the market this product is built for. */
export function formatInr(value: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

/** Trims a whole-number size's trailing ".0" (8.0 -> "8") but keeps halves (8.5 -> "8.5"). */
export function formatSize(size: number): string {
  return Number(size).toString();
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export const SIGNAL_COPY: Record<Signal, { label: string; badge: 'buy' | 'wait' | 'neutral' }> = {
  good_time_to_buy: { label: 'Good time to buy', badge: 'buy' },
  consider_waiting: { label: 'Consider waiting', badge: 'wait' },
  neutral: { label: 'Neutral', badge: 'neutral' },
  insufficient_data: { label: 'Gathering price history', badge: 'neutral' },
};
