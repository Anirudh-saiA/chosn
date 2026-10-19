import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Stores we compare',
  description: 'Every store CHOSN reads prices from, how many shoes each has, how fresh the prices are, and what is not covered.',
};

export const revalidate = 600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface StoreRow {
  slug: string;
  name: string;
  baseUrl: string | null;
  logoUrl: string | null;
  shoes: number;
  brands: number;
  sharePct: number;
  lastUpdated: string | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
}
interface Summary {
  totalShoes: number;
  totalBrands: number;
  stores: StoreRow[];
}

async function load(): Promise<Summary | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/stores`, { next: { revalidate } });
    return res.ok ? ((await res.json()) as Summary) : null;
  } catch {
    return null;
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const ageDays = (iso: string) => (Date.now() - Date.parse(iso)) / 86_400_000;

export default async function StoresPage() {
  const data = await load();
  const stores = data?.stores ?? [];
  const biggest = stores[0];

  return (
    <PageShell width="4xl">
      <PageHeader eyebrow="Where prices come from" title="Stores we compare" />

      <p className="mb-3 max-w-2xl text-[0.98rem] text-text-soft">
        CHOSN reads public prices from the stores below and lists the same shoe side by side. We do not rank shoes by commission. By
        default the shoes you can compare at the most stores come first, then a fixed mix so no brand or store leads just because of
        its name.
      </p>

      {data && (
        <p className="mb-8 font-mono text-[0.78rem] font-bold uppercase tracking-[0.14em] text-text-faint">
          {data.totalShoes.toLocaleString('en-IN')} shoes in stock · {data.totalBrands} brands · {stores.length} stores
        </p>
      )}

      {!data ? (
        <p className="py-10 text-center text-text-soft">Store details are unavailable right now.</p>
      ) : (
        <ul className="space-y-3">
          {stores.map((s) => {
            const stale = s.lastUpdated ? ageDays(s.lastUpdated) > 2 : false;
            return (
              <li key={s.slug} className="grid grid-cols-[3.5rem_1fr] items-center gap-4 rounded-2xl border border-text/10 bg-white p-4 sm:grid-cols-[5rem_1fr_auto]">
                <div className="flex h-12 w-14 items-center justify-center overflow-hidden rounded-lg bg-[#F4F7FB] sm:h-14 sm:w-20">
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-text">{s.name}</p>
                  <p className="text-[0.82rem] text-text-soft">
                    {s.shoes.toLocaleString('en-IN')} shoes · {s.brands} brands · {s.sharePct}% of the catalogue
                    {s.deliveryMinDays !== null && s.deliveryMaxDays !== null && ` · delivery ${s.deliveryMinDays === s.deliveryMaxDays ? s.deliveryMinDays : `${s.deliveryMinDays}–${s.deliveryMaxDays}`} days`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-text/10" aria-hidden>
                    <div className="h-full rounded-full bg-[#D97E00]" style={{ width: `${Math.max(2, s.sharePct)}%` }} />
                  </div>
                </div>
                <p className={`col-span-2 text-[0.8rem] sm:col-span-1 sm:text-right ${stale ? 'font-semibold text-[#B4452A]' : 'text-text-soft'}`}>
                  {s.lastUpdated ? `Prices read ${fmtDate(s.lastUpdated)}` : 'Not read yet'}
                  {stale && ' (older, being refreshed)'}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-10 space-y-3 text-[0.95rem] text-text-soft">
        <h2 className="font-display text-xl font-bold text-text">What this means, honestly</h2>
        {biggest && biggest.sharePct >= 50 && (
          <p>
            {biggest.name} supplies {biggest.sharePct}% of the shoes here, so many shoes are listed at one store only. Those still show
            their real price. Shoes sold at several stores are where comparing helps most, which is why they come first.
          </p>
        )}
        <p>
          Some brand websites (Nike, adidas and ASICS among them) do not allow automated reading, so their shoes reach CHOSN through the
          stores that sell them, not from the brand&apos;s own site. Brands that the stores we read stock less of, such as Reebok, Vans or
          Onitsuka Tiger, have smaller catalogues here.
        </p>
        <p>
          Prices are read about once a day for most stores. Larger stores can take several days to read in full, so a price can be a few
          days old. Check the store&apos;s own page before you buy. Some links may be affiliate links, at no extra cost to you, and that
          does not change the order.
        </p>
      </section>
    </PageShell>
  );
}
