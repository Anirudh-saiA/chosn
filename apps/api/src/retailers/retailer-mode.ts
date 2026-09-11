/**
 * Single source of truth for whether a retailer integration is serving
 * real prices. Previously this logic lived only inside
 * FetchHealthService (as a private `modeFor`), which meant `/health/fetch`
 * knew a source was running on fixtures but nothing surfaced that to the
 * catalog/price-comparison endpoint — a real user could see a fixture
 * price rendered identically to a live one, with no disclosure. Pulled
 * out here so CatalogService and FetchHealthService can never disagree
 * about a given retailer's mode.
 */
export type RetailerMode = 'live' | 'fixture' | 'manual';

/** Env vars that gate each affiliate adapter's isConfigured — kept in sync with each adapter file. */
const AFFILIATE_CONFIGURED: Record<string, () => boolean> = {
  flipkart: () => Boolean(process.env.FLIPKART_AFFILIATE_TOKEN && process.env.FLIPKART_AFFILIATE_ID),
  myntra: () => Boolean(process.env.ADMITAD_ACCESS_TOKEN && process.env.ADMITAD_WEBSITE_ID),
  ajio: () => Boolean(process.env.INRDEALS_API_TOKEN && process.env.INRDEALS_PUBLISHER_ID),
  'end-clothing': () => Boolean(process.env.AWIN_API_TOKEN && process.env.AWIN_PUBLISHER_ID),
};

export function retailerModeFor(slug: string, integrationType: string): RetailerMode {
  if (integrationType === 'manual') return 'manual';
  return AFFILIATE_CONFIGURED[slug]?.() ? 'live' : 'fixture';
}
