import { ArrowUpRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Season { name: string; start: string; end: string; state: 'now' | 'soon'; daysToStart: number }
interface StoreSale { store: string; text: string; kind: string; url: string | null; seenAt: string | null; conditions: string | null }

const fmt = (iso: string) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const range = (s: Season) => (s.start === s.end ? fmt(s.start) : `${fmt(s.start)} to ${fmt(s.end)}`);

async function load(): Promise<{ seasons: Season[]; storeSales: StoreSale[] } | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/sale-season`, { next: { revalidate: 600 } });
    return res.ok ? ((await res.json()) as { seasons: Season[]; storeSales: StoreSale[] }) : null;
  } catch {
    return null;
  }
}

/** Sale seasons on now or coming up, and the sales stores show right now. Season dates are the usual ones; each store sets its own. */
export async function SaleSeason() {
  const data = await load();
  if (!data || (data.seasons.length === 0 && data.storeSales.length === 0)) return null;
  return (
    <section aria-labelledby="sale-h" className="mb-8 rounded-[2rem] border border-[#0A0A0A]/10 bg-white p-6 sm:p-8">
      <h2 id="sale-h" className="font-display text-2xl font-bold text-text">Offer season</h2>
      <p className="mt-1 text-sm text-text-soft">Sales shoppers in India plan around. Dates are the usual ones; each store sets its own, so check the store before you buy.</p>
      {data.seasons.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.seasons.map((s) => (
            <li key={s.name} className="rounded-3xl border border-[#0A0A0A]/10 p-4">
              <span className={`inline-block rounded-full px-3 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] ${s.state === 'now' ? 'bg-[#0A0A0A] text-white' : 'border border-[#0A0A0A]/20 text-text'}`}>
                {s.state === 'now' ? 'On now' : `In ${s.daysToStart} day${s.daysToStart === 1 ? '' : 's'}`}
              </span>
              <p className="mt-3 font-display text-lg font-bold text-text">{s.name}</p>
              <p className="mt-0.5 font-mono text-data-inline font-bold text-text">{range(s)}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data.storeSales.length > 0 ? (
        <div className="mt-6">
          <h3 className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-soft">Live at stores</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.storeSales.map((o, i) => (
              <li key={`${o.store}-${i}`} className="flex items-start justify-between gap-3 rounded-2xl border border-[#0A0A0A]/10 px-4 py-3 text-sm">
                <span><b className="font-semibold text-text">{o.store}</b> <span className="text-text-soft">{o.text}</span></span>
                {o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer" aria-label={`${o.store} offer, opens the store`} className="shrink-0 text-text"><ArrowUpRight className="h-4 w-4" aria-hidden /></a> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
