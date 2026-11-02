/**
 * Sale seasons shoppers in India plan around. These are the usual peak days, not store promises: each store sets its own
 * dates, so the page says "usually" and links the live store offers we actually saw (see CatalogService.liveStoreSales).
 */
export interface SaleSeason {
  name: string;
  /** First and last day (India date, YYYY-MM-DD) the sales usually run. */
  start: string;
  end: string;
  /** now: today is inside it. soon: starts within 30 days. */
  state: 'now' | 'soon';
  daysToStart: number;
}

const SEASONS: Array<{ name: string; start: string; end: string }> = [
  { name: 'Diwali sales', start: '2026-11-02', end: '2026-11-10' },
  { name: "Singles' Day (11.11)", start: '2026-11-11', end: '2026-11-11' },
  { name: 'Black Friday', start: '2026-11-20', end: '2026-11-30' },
  { name: 'Cyber Monday', start: '2026-11-30', end: '2026-11-30' },
  { name: 'End-of-year sales', start: '2026-12-20', end: '2026-12-31' },
  { name: 'Republic Day sales', start: '2027-01-22', end: '2027-01-26' },
];

const DAY = 86_400_000;
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

export function saleSeasons(today: Date, lookAheadDays = 30): SaleSeason[] {
  const t = Date.parse(`${istDay(today)}T00:00:00Z`);
  const out: SaleSeason[] = [];
  for (const s of SEASONS) {
    const start = Date.parse(`${s.start}T00:00:00Z`);
    const end = Date.parse(`${s.end}T00:00:00Z`);
    const daysToStart = Math.round((start - t) / DAY);
    if (t > end) continue;
    if (t >= start) out.push({ ...s, state: 'now', daysToStart: 0 });
    else if (daysToStart <= lookAheadDays) out.push({ ...s, state: 'soon', daysToStart });
  }
  return out;
}

/**
 * Offers read on a store's own page, whether or not we track its prices. Add an entry only after reading the offer on the store's own page, and set checkedOn to that day.
 * An entry is shown for 7 days after checkedOn and then disappears by itself, so a stale offer is never shown as live.
 */
export interface OtherSiteOffer { store: string; logo: string | null; tracked: boolean; /** true = a festive or season sale; false = a standing offer (shown, but not listed under a season). */ seasonal: boolean; text: string; conditions: string | null; url: string; checkedOn: string }

const OTHER_SITES: OtherSiteOffer[] = [
  { store: 'adidas India', logo: '/brands/adidas.png', tracked: false, seasonal: true, text: 'Diwali Sale: Buy 2, get 60% off', conditions: 'Terms are on the adidas site; also 10% off when you sign up', url: 'https://www.adidas.co.in/', checkedOn: '2026-11-02' },
  { store: 'Mainstreet Marketplace', logo: '/stores/mainstreet-marketplace.png', tracked: true, seasonal: true, text: 'Festival Season Sale: up to 32% off selected pairs', conditions: 'A sale section on the home page of the store; the discount differs by pair', url: 'https://marketplace.mainstreet.co.in/', checkedOn: '2026-11-03' },
  { store: 'Limited Edt', logo: '/stores/limited-edt.png', tracked: true, seasonal: false, text: '10% student discount', conditions: 'Banner on the home page; the asterisk means terms apply on the store', url: 'https://limitededt.in/', checkedOn: '2026-11-03' },
];

export function otherSiteOffers(today: Date, maxAgeDays = 7): OtherSiteOffer[] {
  const t = Date.parse(`${istDay(today)}T00:00:00Z`);
  return OTHER_SITES.filter((o) => {
    const age = Math.round((t - Date.parse(`${o.checkedOn}T00:00:00Z`)) / DAY);
    return age >= 0 && age <= maxAgeDays;
  });
}
