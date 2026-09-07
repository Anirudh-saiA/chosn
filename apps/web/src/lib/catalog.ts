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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
