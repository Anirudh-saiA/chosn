/**
 * Where a drop releases, and where a buyer can get it. Pure functions, no imports, so the rules can be tested on their own.
 *
 * Rules (founder, 2026-10-31):
 *  - The India calendar lists only shoes that release in India (or that Indian stores we read already carry).
 *  - Everything else is "Released elsewhere": shown with its country, never mixed into the India list.
 *  - A buy button exists only for a link we actually hold (the drop's stored purchase links, or its source link) AND only when
 *    that link is https on an official domain (the brand's own site, its launch app such as Nike SNKRS, or a named official
 *    retailer). A news site or tracker is a source, not a shop: it never becomes a buy button.
 */

import type { DropConfirmation } from './drops';

export interface RegionDrop {
  regions: string[];
  indiaStatus?: 'unknown' | 'confirmed_india' | 'global_only' | 'in_indian_stores';
  confirmation?: DropConfirmation;
  sourceName?: string | null;
  sourceUrl?: string | null;
  purchaseLinks?: unknown;
}

/** True when the shoe releases in India: the drop names India, India is confirmed, or an Indian store we read lists it now. */
export function isIndiaDrop(d: RegionDrop): boolean {
  return d.regions.includes('india') || d.indiaStatus === 'confirmed_india' || d.indiaStatus === 'in_indian_stores';
}

const COUNTRY: Record<string, { name: string; code: string }> = {
  us: { name: 'United States', code: 'US' },
  usa: { name: 'United States', code: 'US' },
  uk: { name: 'United Kingdom', code: 'UK' },
  gb: { name: 'United Kingdom', code: 'UK' },
  eu: { name: 'Europe', code: 'EU' },
  europe: { name: 'Europe', code: 'EU' },
  japan: { name: 'Japan', code: 'JP' },
  jp: { name: 'Japan', code: 'JP' },
  china: { name: 'China', code: 'CN' },
  cn: { name: 'China', code: 'CN' },
  korea: { name: 'South Korea', code: 'KR' },
  kr: { name: 'South Korea', code: 'KR' },
  australia: { name: 'Australia', code: 'AU' },
  au: { name: 'Australia', code: 'AU' },
  canada: { name: 'Canada', code: 'CA' },
  ca: { name: 'Canada', code: 'CA' },
  uae: { name: 'United Arab Emirates', code: 'AE' },
  singapore: { name: 'Singapore', code: 'SG' },
  global: { name: 'Worldwide', code: 'WW' },
};

export interface CountryLabel {
  /** Name to show, e.g. "United States". */
  name: string;
  /** Short code for the little badge, e.g. "US". */
  code: string;
  /** True when the data only says a region, not a country we can name. */
  vague: boolean;
}

/** The country a non-India drop releases in, from its region tags. Never guesses: no tag means "Country not stated". */
export function countryOf(d: Pick<RegionDrop, 'regions'>): CountryLabel {
  for (const r of d.regions) {
    const hit = COUNTRY[r.toLowerCase()];
    if (hit && hit.code !== 'WW') return { ...hit, vague: false };
  }
  if (d.regions.some((r) => r.toLowerCase() === 'global')) return { name: 'Worldwide (country not stated)', code: 'WW', vague: true };
  return { name: 'Country not stated', code: '--', vague: true };
}

/** Official hosts. A host matches when it equals one of these or is a subdomain of it. Brand sites first, then named official retailers. */
const OFFICIAL_HOSTS: Array<{ host: RegExp; label: string }> = [
  { host: /(^|\.)nike\.com$/, label: 'Nike' },
  { host: /(^|\.)jordan\.com$/, label: 'Jordan' },
  { host: /(^|\.)adidas\.[a-z]{2,3}(\.[a-z]{2})?$/, label: 'adidas' },
  { host: /(^|\.)newbalance\.[a-z]{2,3}(\.[a-z]{2})?$/, label: 'New Balance' },
  { host: /(^|\.)puma\.com$/, label: 'Puma' },
  { host: /(^|\.)asics\.com$/, label: 'ASICS' },
  { host: /(^|\.)onitsukatiger\.com$/, label: 'Onitsuka Tiger' },
  { host: /(^|\.)reebok\.[a-z]{2,3}(\.[a-z]{2})?$/, label: 'Reebok' },
  { host: /(^|\.)converse\.com$/, label: 'Converse' },
  { host: /(^|\.)vans\.com$/, label: 'Vans' },
  { host: /(^|\.)hoka\.com$/, label: 'HOKA' },
  { host: /(^|\.)on\.com$/, label: 'On' },
  { host: /(^|\.)salomon\.com$/, label: 'Salomon' },
  { host: /(^|\.)crocs\.[a-z]{2,3}(\.[a-z]{2})?$/, label: 'Crocs' },
  { host: /(^|\.)saucony\.com$/, label: 'Saucony' },
  { host: /(^|\.)underarmour\.[a-z]{2,3}(\.[a-z]{2})?$/, label: 'Under Armour' },
  { host: /(^|\.)wearcomet\.com$/, label: 'Comet' },
  { host: /(^|\.)gullylabs\.com$/, label: 'Gully Labs' },
  { host: /(^|\.)footlocker\.[a-z]{2,3}(\.[a-z]{2})?$/, label: 'Foot Locker' },
  { host: /(^|\.)finishline\.com$/, label: 'Finish Line' },
  { host: /(^|\.)jdsports\.[a-z]{2,3}(\.[a-z]{2})?$/, label: 'JD Sports' },
  { host: /(^|\.)endclothing\.com$/, label: 'END.' },
  { host: /(^|\.)sneakersnstuff\.com$/, label: 'Sneakersnstuff' },
  { host: /(^|\.)kith\.com$/, label: 'Kith' },
];

export interface OfficialLink {
  url: string;
  /** Who runs the page, e.g. "Nike" or "Nike SNKRS" when the stored link names it. */
  label: string;
  host: string;
}

/** The label for an https link on an official host, or null when the link is not safe or not official. */
export function officialHost(raw: unknown): { url: string; host: string; label: string } | null {
  if (typeof raw !== 'string') return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  const hit = OFFICIAL_HOSTS.find((h) => h.host.test(host));
  return hit ? { url: u.toString(), host, label: hit.label } : null;
}

/**
 * Every official buy link we hold for a drop: its stored purchase links, then its source link when that is itself on an official host.
 * No official link means an empty list, and the page shows no button.
 */
export function officialLinks(d: RegionDrop): OfficialLink[] {
  const out: OfficialLink[] = [];
  const seen = new Set<string>();
  const add = (url: unknown, name?: unknown) => {
    const ok = officialHost(url);
    if (!ok || seen.has(ok.url)) return;
    seen.add(ok.url);
    out.push({ url: ok.url, host: ok.host.replace(/^www\./, ''), label: typeof name === 'string' && name.trim() ? name.trim() : ok.label });
  };
  if (Array.isArray(d.purchaseLinks)) {
    for (const l of d.purchaseLinks as Array<Record<string, unknown> | null>) {
      if (l && typeof l === 'object') add(l.url, l.retailer_name ?? l.label);
    }
  }
  add(d.sourceUrl);
  return out;
}

/** A link to read about the drop (a tracker or news site). Shown as "Source", never as a place to buy. */
export function sourceLink(d: RegionDrop): { url: string; name: string } | null {
  if (!d.sourceUrl) return null;
  try {
    const u = new URL(d.sourceUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return { url: u.toString(), name: d.sourceName?.trim() || u.hostname.replace(/^www\./, '') };
  } catch {
    return null;
  }
}
