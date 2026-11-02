'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchBudget, type BudgetItem } from '@/lib/budget';
import { BrandMark } from '@/components/ui/BrandMark';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { formatInr, formatSize } from '@/lib/catalog';

// Pure black and white, Inter, no gradients (founder rule, 2026-10-27). Inter now comes from the root layout.

const BANDS = [5000, 10000, 15000, 20000] as const;
type Band = (typeof BANDS)[number];
const TOP = 10;

/**
 * RANKING (one place): how every tab is ordered. 'popular' is the API's ranking today: the pairs sold at the most stores (2 or more).
 * Founder decision 2026-10-28: rank by each day's most viewed and most clicked pairs, falling back to store count. That ranking is a Back end
 * and nightly job (not built yet); when it ships, change RANKING and RANK_NOTE here and nothing else. The note must always say what the
 * ranking really is.
 */
const RANKING = 'popular';
const RANK_NOTE = 'Ranked by how many stores sell the pair.';

const listCache = new Map<Band, BudgetItem[]>();

/** One pair as a card, in the style of the cards on the shoe pages: photo, brand, name, price and store. The whole card opens the shoe. */
function Card({ item, rank }: { item: BudgetItem; rank: number }) {
  const href = `/sneakers/${encodeURIComponent(item.styleCode)}/${formatSize(item.size)}`;
  const offerCount = item.offers.length;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-[#0A0A0A]/10 bg-white transition-colors duration-300 hover:border-[#0A0A0A]">
      <Link href={href} aria-label={`${item.brand} ${item.model}, ${formatInr(item.priceInr)} at ${item.store.name}`} className="absolute inset-0 z-10 rounded-[2rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]" />
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F4F5F7]">
        {item.primaryImageUrl ? (
          <ShoePhoto key={item.primaryImageUrl} src={item.primaryImageUrl} alt="" className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
        ) : null}
        <span className="absolute left-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 font-mono text-[0.72rem] font-bold tabular-nums text-[#0A0A0A] ring-1 ring-[#0A0A0A]/10" aria-label={`Number ${rank}`}>{rank}</span>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <BrandMark brand={item.brand} className="!h-4 !max-w-[3.2rem]" />
        <h3 className="mt-1.5 line-clamp-2 font-display text-[1.05rem] uppercase leading-[0.98] tracking-[0.01em] text-[#0A0A0A]">{item.model}</h3>
        <p className="mt-0.5 truncate text-[0.72rem] font-medium text-[#0A0A0A]/55">{item.colorway} · UK {formatSize(item.size)}</p>
        <p className="mt-2 font-sans text-[1.25rem] font-extrabold leading-none tabular-nums text-[#0A0A0A]">{formatInr(item.priceInr)}</p>
        <p className="mt-1.5 text-[0.76rem] text-[#0A0A0A]/70">
          <span className="font-semibold text-[#0A0A0A]">{item.store.name}</span>
          {item.storeCount > 1 ? ` · cheapest of ${item.storeCount} stores` : ''}
        </p>
        {offerCount > 0 ? <p className="mt-2 inline-flex w-fit rounded-full border border-[#0A0A0A]/20 px-2.5 py-0.5 text-[0.68rem] font-semibold text-[#0A0A0A]">{offerCount} offer{offerCount === 1 ? '' : 's'} at {item.store.name}</p> : null}
      </div>
    </li>
  );
}

/**
 * "Shop by budget": four tabs, Under ₹5,000 / ₹10,000 / ₹15,000 / ₹20,000. Each shows the top 10 pairs under that price (ranked as RANKING says),
 * each with its cheapest in-stock store and the coupons and offers that store publishes (code, conditions, date seen, source). Nothing is
 * calculated: we never show a "price after coupon". One call per tab to GET /catalog/budget.
 * Built to sit inside the Releases > Drops tab; it fetches its own data in the browser, so the page needs no change besides placing it.
 */
export function BudgetShelf() {
  const [band, setBand] = useState<Band>(5000);
  const [items, setItems] = useState<BudgetItem[] | null>(listCache.get(5000) ?? null);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let live = true;
    setFailed(false);
    setSlow(false);
    const cached = listCache.get(band);
    setItems(cached ?? null);
    if (cached) return;
    const slowTimer = setTimeout(() => live && setSlow(true), 10000);
    const load = () => fetchBudget(band, RANKING, TOP, undefined, BANDS[BANDS.indexOf(band) - 1] ?? 0);
    // One quiet retry after 3 seconds: a brief gap while the server restarts should not show an error.
    load()
      .catch(() => new Promise<BudgetItem[]>((resolve, reject) => setTimeout(() => (live ? load().then(resolve, reject) : reject(new Error('left'))), 3000)))
      .then((list) => {
        listCache.set(band, list);
        if (live) setItems(list);
      })
      .catch(() => live && setFailed(true))
      .finally(() => clearTimeout(slowTimer));
    return () => {
      live = false;
      clearTimeout(slowTimer);
    };
  }, [band]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + BANDS.length) % BANDS.length;
    setBand(BANDS[n]!);
    tabRefs.current[n]?.focus();
  };

  return (
    <section aria-labelledby="budget-h" className={`font-sans w-full rounded-[2rem] border border-black/20 bg-white p-4 text-black sm:p-7`}>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-black/65">Cheapest in stock</p>
      <h2 id="budget-h" className="mt-1 text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold leading-tight tracking-tight">
        Shop by budget
      </h2>
      <p className="mt-2 max-w-xl text-[0.92rem] leading-relaxed text-black/80">
        The top {TOP} pairs under each price, each with its cheapest in-stock store. Open a pair to see every store, the photos and the offers. Prices are in rupees and come from the stores&apos; own pages.
      </p>

      <div role="tablist" aria-label="Budget" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BANDS.map((b, i) => {
          const on = b === band;
          return (
            <button
              key={b}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`budget-tab-${b}`}
              aria-selected={on}
              aria-controls="budget-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setBand(b)}
              onKeyDown={(e) => onKey(e, i)}
              className={`min-h-[56px] rounded-2xl border border-black/25 px-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                on ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/5'
              }`}
            >
              <span className="block text-[0.95rem] font-bold leading-tight">Under {formatInr(b)}</span>
              <span className={`block text-[0.72rem] ${on ? 'text-white/80' : 'text-black/65'}`}>Top {TOP}</span>
            </button>
          );
        })}
      </div>

      <div id="budget-panel" role="tabpanel" aria-labelledby={`budget-tab-${band}`} className="mt-3" aria-busy={items === null && !failed}>
        {failed ? (
          <p className="py-8 text-center text-[0.92rem] text-black/80">Could not load this budget right now. Please try again in a moment.</p>
        ) : items === null ? (
          <div role="status" className="py-2">
            <p className="sr-only">Loading pairs under {formatInr(band)}</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
              {[0, 1, 2, 3, 4].map((n) => (
                <div key={n} aria-hidden className="overflow-hidden rounded-[2rem] border border-black/10">
                  <div className="skeleton aspect-[4/3] w-full" />
                  <div className="space-y-2 p-4">
                    <div className="skeleton h-3 w-12 rounded-full" />
                    <div className="skeleton h-4 w-3/4 rounded-full" />
                    <div className="skeleton h-6 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
            {slow ? <p className="pt-3 text-center text-[0.8rem] text-black/65">This is taking longer than usual. You can wait or try another tab.</p> : null}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-[0.92rem] text-black/80">No pair sold at two or more stores is in stock under {formatInr(band)} right now.</p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
              {items.map((it, i) => (
                <Card key={`${it.styleCode}-${it.size}`} item={it} rank={i + 1} />
              ))}
            </ul>
            <p className="pt-3 text-center text-[0.74rem] text-black/65">{RANK_NOTE}</p>
          </>
        )}
      </div>
    </section>
  );
}
