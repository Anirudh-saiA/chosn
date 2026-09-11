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
  fetchedAt: string;
  fetchFrequencyMinutes: number;
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
}

export interface CatalogResponse {
  sneaker: CatalogSneaker;
  variant: CatalogVariant;
  siblingSizes: SiblingSize[];
  offers: CatalogOffer[];
  marketIntelligence: MarketIntelligence | null;
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
}

export interface CommunityPostSearchResult {
  id: string;
  postType: string;
  title: string | null;
  preview: string;
  authorDisplayName: string | null;
  createdAt: string;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  brands: string[];
  communityPosts: CommunityPostSearchResult[];
}

export interface SearchQuery {
  q?: string;
  brand?: string;
  signal?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Server-side search/browse (Day 11) — query params drive the filter, same endpoint either way. */
export async function fetchSearch(query: SearchQuery, init?: RequestInit): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.brand) params.set('brand', query.brand);
  if (query.signal) params.set('signal', query.signal);

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
