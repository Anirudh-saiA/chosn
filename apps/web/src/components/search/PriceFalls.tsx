import Link from 'next/link';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { formatInr, formatSize } from '@/lib/catalog';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface PriceDrop {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  size: number;
  previousPrice: number;
  currentPrice: number;
  dropPct: number;
  store: string;
  previousDay: string;
  currentDay: string;
}

export async function fetchPriceDrops(limit: number): Promise<PriceDrop[]> {
  try {
    const res = await fetch(`${API_URL}/catalog/price-drops?limit=${limit}`, { next: { revalidate: 600 } });
    return res.ok ? ((await res.json()) as PriceDrop[]) : [];
  } catch {
    return [];
  }
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function FallCard({ d }: { d: PriceDrop }) {
  const img = resolveSneakerImage(d.primaryImageUrl);
  return (
    <Link
      href={`/sneakers/${encodeURIComponent(d.styleCode)}/${formatSize(d.size)}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#0A0A0A]/10 bg-white transition-colors hover:border-[#0A0A0A]"
    >
      <div className="relative aspect-[4/3] bg-white">
        {img && <ShoePhoto src={img} alt={`${d.brand} ${d.model}`} className="absolute inset-0 h-full w-full object-contain p-5" fallback={<span />} />}
        <span className="absolute left-3 top-3 rounded-full bg-[#0A0A0A] px-2.5 py-1 font-mono text-[0.72rem] font-bold text-white">−{Math.round(d.dropPct)}%</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#0A0A0A]/50">{d.brand}</p>
        <p className="line-clamp-2 font-display text-[1.15rem] uppercase leading-tight text-[#0A0A0A]">{d.model}</p>
        <p className="text-[0.78rem] text-[#0A0A0A]/55">UK {formatSize(d.size)} · {d.store}</p>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="font-mono text-[1.25rem] font-extrabold tabular-nums text-[#0A0A0A]">{formatInr(d.currentPrice)}</span>
          <span className="font-mono text-[0.8rem] tabular-nums text-[#0A0A0A]/45 line-through">{formatInr(d.previousPrice)}</span>
        </div>
        <p className="text-[0.7rem] text-[#0A0A0A]/45">was this on {day(d.previousDay)}</p>
      </div>
    </Link>
  );
}

/**
 * "Crazy falls": the biggest price cuts since the previous recorded day, from the real price history. A cut means the store with the
 * cheapest price lowered it (a cheaper store merely appearing does not count). Hidden when there is none, so it never shows filler.
 */
export async function PriceFalls() {
  const drops = await fetchPriceDrops(8);
  if (drops.length === 0) return null;
  return (
    <section aria-labelledby="falls-h" className="mb-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#D97E00]">Since yesterday</p>
          <h2 id="falls-h" className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] uppercase leading-none tracking-[0.01em] text-[#0A0A0A]">Crazy falls</h2>
        </div>
        <Link href="/price-drops" className="text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]/60 hover:text-[#0A0A0A]">
          See all →
        </Link>
      </div>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        {drops.map((d) => (
          <li key={`${d.styleCode}-${d.size}`} className="w-[15rem] shrink-0 snap-start sm:w-auto">
            <FallCard d={d} />
          </li>
        ))}
      </ul>
    </section>
  );
}
