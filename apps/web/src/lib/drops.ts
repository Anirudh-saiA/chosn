/** Mirrors apps/api/src/drops/drops.controller.ts's DropEventSummary. */
export interface DropEventSummary {
  id: string;
  status: 'upcoming' | 'live' | 'sold_out';
  releaseDate: string;
  releaseTime: string | null;
  releaseTimezone: string;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  purchaseLinks: unknown;
  raffleInfo: unknown;
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
