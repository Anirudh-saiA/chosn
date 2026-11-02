import { ArrowUpRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Season { name: string; start: string; end: string; state: 'now' | 'soon'; daysToStart: number }
interface OtherSite { store: string; logo: string | null; tracked: boolean; seasonal: boolean; text: string; conditions: string | null; url: string; checkedOn: string }
interface StoreSale { store: string; logo: string | null; text: string; kind: string; url: string | null; seenAt: string | null; conditions: string | null }

const fmt = (iso: string) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const range = (s: Season) => (s.start === s.end ? fmt(s.start) : `${fmt(s.start)} to ${fmt(s.end)}`);

async function load(): Promise<{ seasons: Season[]; storeSales: StoreSale[]; otherSites: OtherSite[] } | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/sale-season`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as { seasons: Season[]; storeSales: StoreSale[]; otherSites: OtherSite[] }) : null;
  } catch {
    return null;
  }
}

/** The store's own logo in its own colours, in a white rounded tile. */
function Logo({ src, name }: { src: string | null; name: string }) {
  if (!src) return null;
  return <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#0A0A0A]/10 bg-white p-1.5"><img src={src} alt={name} className="max-h-full max-w-full object-contain" loading="lazy" /></span>;
}

/** The stores whose own page or banner we read showing a sale today, for a season that is on now. Empty when there are none. */
function seenAt(season: Season, sales: StoreSale[], others: OtherSite[]): Array<{ store: string; url: string | null; logo: string | null }> {
  if (season.state !== 'now') return [];
  const seen = new Map<string, { store: string; url: string | null; logo: string | null }>();
  for (const o of others) if (o.seasonal) seen.set(o.store, { store: o.store, url: o.url, logo: o.logo });
  for (const o of sales) if (o.kind === 'sale') seen.set(o.store, { store: o.store, url: o.url, logo: o.logo });
  return [...seen.values()];
}

/** Only the logos of the stores that have the season's sale; each opens its store. */
function SeenAt({ stores }: { stores: ReturnType<typeof seenAt> }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Stores with this sale">
      {stores.map((o) => {
        const tile = <Logo src={o.logo} name={o.store} />;
        return (
          <li key={o.store}>
            {o.url ? (
              <a href={o.url} target="_blank" rel="noopener noreferrer" title={o.store} aria-label={`${o.store}, opens the store`} className="block rounded-2xl transition-shadow hover:ring-2 hover:ring-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A0A0A]">{tile}</a>
            ) : (
              <span title={o.store}>{tile}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface OfferRow { store: string; logo: string | null; text: string; url: string | null; label: string; date: string; order: number; at: string }

/** One list, in order: season sales first, then other sales and standing offers, then coupons; newest first within each. */
function offerRows(sales: StoreSale[], others: OtherSite[]): OfferRow[] {
  const rows: OfferRow[] = [
    ...others.map((o) => ({ store: o.store, logo: o.logo, text: o.text, url: o.url, label: o.seasonal ? 'Sale' : 'Offer', date: fmt(o.checkedOn), order: o.seasonal ? 0 : 1, at: o.checkedOn })),
    ...sales.map((o) => ({ store: o.store, logo: o.logo, text: o.text, url: o.url, label: o.kind === 'coupon' ? 'Coupon' : 'Sale', date: o.seenAt ? fmt(o.seenAt) : '', order: o.kind === 'coupon' ? 2 : 0, at: o.seenAt ?? '' })),
  ];
  return rows.sort((a, b) => a.order - b.order || b.at.localeCompare(a.at) || a.store.localeCompare(b.store));
}

/** Sale seasons on now or coming up, and the sales stores show right now. Season dates are the usual ones; each store sets its own. */
export async function SaleSeason() {
  const data = await load();
  if (!data || (data.seasons.length === 0 && data.storeSales.length === 0 && data.otherSites.length === 0)) return null;
  // A season is listed only when a store is really running it: no store, no card.
  const rows = offerRows(data.storeSales, data.otherSites);
  const withStores = data.seasons.map((s) => ({ s, stores: seenAt(s, data.storeSales, data.otherSites) })).filter((x) => x.stores.length > 0);
  return (
    <section aria-labelledby="sale-h" className="mb-8 rounded-[2rem] border border-[#0A0A0A]/10 bg-white p-6 sm:p-8">
      <h2 id="sale-h" className="font-display text-2xl font-bold text-text">Offer season</h2>
      <p className="mt-1 text-sm text-text-soft">Sales shoppers in India plan around. Dates are the usual ones; each store sets its own, so check the store before you buy.</p>
      {withStores.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {withStores.map(({ s, stores }) => (
            <li key={s.name} className="rounded-3xl border border-[#0A0A0A]/10 p-4">
              <span className="inline-block rounded-full bg-[#0A0A0A] px-3 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white">On now</span>
              <p className="mt-3 font-display text-lg font-bold text-text">{s.name}</p>
              <p className="mt-0.5 font-mono text-data-inline font-bold text-text">{range(s)}</p>
              <SeenAt stores={stores} />
            </li>
          ))}
        </ul>
      ) : null}
      {rows.length > 0 ? (
        <div className="mt-6">
          <h3 className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-soft">Offers at stores</h3>
          <ul className="mt-3 divide-y divide-[#0A0A0A]/10 overflow-hidden rounded-3xl border border-[#0A0A0A]/10">
            {rows.map((o) => {
              const inner = (
                <>
                  <Logo src={o.logo} name={o.store} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{o.text}</span>
                    <span className="block truncate text-xs text-text-soft">{o.store} · {o.label} · {o.date}</span>
                  </span>
                  {o.url ? <ArrowUpRight className="h-4 w-4 shrink-0 text-text" aria-hidden /> : null}
                </>
              );
              const cls = 'flex items-center gap-3 px-4 py-3';
              return (
                <li key={`${o.store}-${o.text}`}>
                  {o.url ? (
                    <a href={o.url} target="_blank" rel="noopener noreferrer" aria-label={`${o.store}: ${o.text}. Opens the store`} className={`${cls} transition-colors hover:bg-[#0A0A0A]/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A0A0A]`}>{inner}</a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
