'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { formatInr, formatSize } from '@/lib/catalog';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

export interface Deal {
  key: string;
  styleCode: string;
  brand: string;
  model: string;
  image: string | null;
  size: number;
  store: string;
  now: number;
  was: number;
  pct: number;
  note: string;
}

export function DealCard({ d }: { d: Deal }) {
  const img = resolveSneakerImage(d.image);
  return (
    <Link
      href={`/sneakers/${encodeURIComponent(d.styleCode)}/${formatSize(d.size)}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#0A0A0A]/10 bg-white transition-colors hover:border-[#0A0A0A]"
    >
      <div className="relative aspect-[4/3] bg-white">
        {img && <ShoePhoto src={img} alt={`${d.brand} ${d.model}`} className="absolute inset-0 h-full w-full object-contain p-5" fallback={<span />} />}
        <span className="absolute left-3 top-3 rounded-full bg-[#0A0A0A] px-2.5 py-1 font-mono text-[0.72rem] font-bold text-white">−{Math.round(d.pct)}%</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#0A0A0A]/50">{d.brand}</p>
        <p className="line-clamp-2 font-display text-[1.15rem] uppercase leading-tight text-[#0A0A0A]">{d.model}</p>
        <p className="text-[0.78rem] text-[#0A0A0A]/55">
          UK {formatSize(d.size)} · {d.store}
        </p>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="font-mono text-[1.25rem] font-extrabold tabular-nums text-[#0A0A0A]">{formatInr(d.now)}</span>
          <span className="font-mono text-[0.8rem] tabular-nums text-[#0A0A0A]/45 line-through">{formatInr(d.was)}</span>
        </div>
        <p className="text-[0.7rem] text-[#0A0A0A]/45">{d.note}</p>
      </div>
    </Link>
  );
}

const TABS = [
  { id: 'falls', label: 'Since yesterday', hint: 'The store cut its price since the previous day we recorded.' },
  { id: 'sale', label: 'Store sale prices', hint: 'Against the "was" price the store itself lists. That is the store\'s claim, not ours.' },
] as const;

export function DealsTabs({ falls, sale }: { falls: Deal[]; sale: Deal[] }) {
  const [tab, setTab] = useState<'falls' | 'sale'>(falls.length > 0 ? 'falls' : 'sale');
  const [more, setMore] = useState(false);
  const list = tab === 'falls' ? falls : sale;
  const hint = TABS.find((t) => t.id === tab)!.hint;
  return (
    <section aria-labelledby="falls-h" className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#D97E00]">Biggest cuts</p>
          <h2 id="falls-h" className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] uppercase leading-none tracking-[0.01em] text-[#0A0A0A]">
            Crazy falls
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div role="tablist" aria-label="Kind of fall" className="flex overflow-hidden rounded-full border border-[#0A0A0A]/15">
            {TABS.map((t) => {
              const count = t.id === 'falls' ? falls.length : sale.length;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  disabled={count === 0}
                  onClick={() => {
                    setTab(t.id);
                    setMore(false);
                  }}
                  className={`px-3.5 py-1.5 text-[0.74rem] font-bold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${tab === t.id ? 'bg-[#0A0A0A] text-white' : 'text-[#0A0A0A]/65 hover:bg-[#0A0A0A]/5'}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <Link href="/price-drops" className="text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]/60 hover:text-[#0A0A0A]">
            See all →
          </Link>
        </div>
      </div>
      <p className="mb-3 text-[0.8rem] text-[#0A0A0A]/55">{hint}</p>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        {list.slice(0, more ? 24 : 8).map((d) => (
          <li key={d.key} className="w-[15rem] shrink-0 snap-start sm:w-auto">
            <DealCard d={d} />
          </li>
        ))}
      </ul>
      {list.length > 8 && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="rounded-full border border-[#0A0A0A]/15 px-5 py-2 text-[0.78rem] font-bold uppercase tracking-[0.1em] text-[#0A0A0A]/70 transition-colors hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
          >
            {more ? 'Show fewer' : `Show ${Math.min(list.length, 24) - 8} more`}
          </button>
        </div>
      )}
      {list.length <= 8 && (
        <p className="mt-2 text-center text-[0.75rem] text-[#0A0A0A]/45">
          That is all of them right now: {list.length} {tab === 'falls' ? 'price cuts of 15% or more since yesterday' : 'store discounts of 20% or more'}.
        </p>
      )}
    </section>
  );
}
