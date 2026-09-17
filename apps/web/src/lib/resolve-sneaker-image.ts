/**
 * One shared resolution function, called from every surface that shows
 * a sneaker photo — the price comparison page (which has full retailer
 * offer data), the search/browse grid and community post composer
 * (which only ever have the canonical `primaryImageUrl`, no offers).
 * Both are real, correct inputs to this same function rather than two
 * different resolution rules: the retailer-fallback tier just never
 * triggers where there's no `offers` array to read, which is honestly
 * what "no offer-level image data available here" means — not a
 * degraded call site, a call site with less to resolve from.
 *
 * Priority, per the actual product decision:
 *   1. `primaryImageUrl` — the canonical, curated photo (sneakers.primary_image_url)
 *   2. The most-recently-fetched in-stock offer's own `imageUrl`
 *   3. `null` — the caller's placeholder is the last resort, not this
 *      function's job. `SneakerPlaceholderArt.tsx` already is that
 *      placeholder (a deliberate typographic treatment, not a generic
 *      icon — kept as-is) and every one of its call sites already
 *      renders correctly on `null`; this function only decides *which*
 *      URL wins, not what to show when none do.
 */

export interface ImageResolutionOffer {
  imageUrl: string | null;
  inStock: boolean;
  fetchedAt: string;
}

export function resolveSneakerImage(
  primaryImageUrl: string | null | undefined,
  offers?: ImageResolutionOffer[],
): string | null {
  if (primaryImageUrl) return primaryImageUrl;

  const candidates = (offers ?? []).filter((o) => o.imageUrl && o.inStock);
  if (candidates.length === 0) return null;

  // "Prefer the one with the most recent successful fetch" — sort
  // in-stock candidates by fetchedAt, newest first.
  candidates.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  return candidates[0]!.imageUrl;
}
