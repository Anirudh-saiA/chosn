'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Copy } from 'lucide-react';
import { fetchBudget, type BudgetItem, type BudgetOffer } from '@/lib/budget';
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

const KIND_LABEL: Record<string, string> = {
  sale: 'Sale',
  coupon: 'Coupon',
  bank: 'Bank offer',
  card: 'Card offer',
  wallet: 'Wallet',
  emi: 'EMI',
  shipping: 'Shipping',
  credit: 'Credit',
  info: 'Note',
};

const listCache = new Map<Band, BudgetItem[]>();

function shortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        try {
          void navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the code is still on screen */
        }
      }}
      aria-label={`Copy code ${code}`}
      className="relative inline-flex items-center gap-1.5 rounded-full border border-dashed border-black px-2.5 py-0.5 font-semibold tracking-wide text-black before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] hover:bg-black hover:text-white"
    >
      {code} <Copy className="h-3 w-3" aria-hidden /> {done && <span className="text-[0.7rem] font-medium">copied</span>}
    </button>
  );
}

function OfferLine({ o }: { o: BudgetOffer }) {
  const seen = shortDate(o.seenAt);
  return (
    <li className="text-[0.86rem] leading-snug text-black">
      <span className="mr-2 inline-block rounded-full border border-black px-2 py-px text-[0.66rem] font-semibold uppercase tracking-wider">{KIND_LABEL[o.kind] ?? 'Offer'}</span>
      {o.text}
      {o.code && (
        <span className="ml-2 align-middle">
          <CopyCode code={o.code} />
        </span>
      )}
      {(o.conditions || seen || o.source) && (
        <span className="mt-0.5 block text-[0.74rem] text-black/65">
          {[o.conditions, seen ? `seen ${seen}` : null, o.source ? `source: ${o.source}` : null].filter(Boolean).join(' · ')}
        </span>
      )}
    </li>
  );
}

function Row({ item, rank }: { item: BudgetItem; rank: number }) {
  const href = `/sneakers/${encodeURIComponent(item.styleCode)}/${item.size}`;
  const shown = item.offers.slice(0, 3);
  const rest = item.offers.slice(3);
  const seenOn = shortDate(item.fetchedAt);
  const buyLabel = `Buy at ${item.store.name} for ${formatInr(item.priceInr)} (opens in a new tab)`;

  return (
    <li className="border-b border-black/15 py-5 last:border-b-0">
      <div className="flex gap-3 sm:gap-4">
        <span className="w-6 shrink-0 pt-1 text-[1.1rem] font-extrabold tabular-nums text-black sm:w-8" aria-label={`Number ${rank}`}>
          {rank}
        </span>
        <Link href={href} className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-black/15 bg-white sm:h-24 sm:w-24">
          {item.primaryImageUrl ? <img src={item.primaryImageUrl} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-contain p-1.5" /> : null}
          <span className="sr-only">{item.brand} {item.model}</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[0.74rem] font-semibold uppercase tracking-wider text-black/65">{item.brand}</p>
          <Link href={href} className="block text-[1.02rem] font-bold leading-snug text-black hover:underline">
            {item.model}
          </Link>
          <p className="truncate text-[0.82rem] text-black/65">{item.colorway} · UK {formatSize(item.size)}</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-[1.65rem] font-extrabold leading-none tabular-nums text-black">{formatInr(item.priceInr)}</p>
            <p className="text-[0.82rem] text-black/80">
              <span className="font-semibold text-black">{item.store.name}</span>
              {item.storeCount > 1 ? ` · cheapest of ${item.storeCount} stores` : ''}
            </p>
          </div>
          <p className="mt-1 text-[0.74rem] text-black/65">
            {item.shippingCost > 0 ? `Includes ${formatInr(item.shippingCost)} shipping` : 'No shipping charge listed'}
            {seenOn ? ` · price seen ${seenOn}` : ''}
          </p>
        </div>
        <a
          href={item.listingUrl}
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label={buyLabel}
          className="hidden min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-full bg-black px-5 text-[0.78rem] font-bold uppercase tracking-wider text-white hover:bg-black/80 sm:inline-flex"
        >
          Buy <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>

      <div className="mt-3 rounded-2xl border border-black/15 bg-[#FAFAFA] p-3.5 sm:ml-[3.25rem]">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-black/65">Coupons and offers at {item.store.name}</p>
        {item.offers.length === 0 ? (
          <p className="mt-1.5 text-[0.86rem] text-black/80">This store lists no coupons or offers for this shoe right now.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2.5">
              {shown.map((o) => (
                <OfferLine key={o.text} o={o} />
              ))}
            </ul>
            {rest.length > 0 && (
              <details className="group mt-2.5">
                <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-[0.82rem] font-semibold text-black underline underline-offset-4 [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show {rest.length} more offer{rest.length === 1 ? '' : 's'}</span>
                  <span className="hidden group-open:inline">Hide the extra offers</span>
                </summary>
                <ul className="space-y-2.5">
                  {rest.map((o) => (
                    <OfferLine key={o.text} o={o} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        <p className="mt-2 text-[0.72rem] text-black/65">
          Offers are as the store lists them and can change at checkout. We do not work out a price after the offer.{' '}
          <Link href={href} className="font-semibold text-black underline underline-offset-4">
            Compare all stores
          </Link>
        </p>
      </div>

      <a
        href={item.listingUrl}
        target="_blank"
        rel="nofollow sponsored noopener"
        aria-label={buyLabel}
        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-black px-5 text-[0.78rem] font-bold uppercase tracking-wider text-white hover:bg-black/80 sm:hidden"
      >
        Buy at {item.store.name} <ArrowUpRight className="h-4 w-4" aria-hidden />
      </a>
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
    fetchBudget(band, RANKING, TOP)
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
    <section aria-labelledby="budget-h" className={`font-sans mx-auto w-full max-w-3xl rounded-[24px] border border-black/20 bg-white p-4 sm:rounded-[28px] text-black sm:p-7`}>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-black/65">Coupons and offers included</p>
      <h2 id="budget-h" className="mt-1 text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold leading-tight tracking-tight">
        Shop by budget
      </h2>
      <p className="mt-2 max-w-xl text-[0.92rem] leading-relaxed text-black/80">
        The top {TOP} pairs under each price, each with its cheapest in-stock store and the coupons and offers that store lists. Prices are in rupees and come from the stores&apos; own pages.
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
            {[0, 1, 2].map((n) => (
              <div key={n} aria-hidden className="flex gap-3 border-b border-black/10 py-5 last:border-b-0 sm:gap-4">
                <div className="skeleton h-5 w-6 shrink-0 rounded-full" />
                <div className="skeleton h-20 w-20 shrink-0 rounded-xl sm:h-24 sm:w-24" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="skeleton h-3 w-16 rounded-full" />
                  <div className="skeleton h-4 w-3/4 rounded-full" />
                  <div className="skeleton h-7 w-28 rounded-full" />
                </div>
              </div>
            ))}
            {slow ? <p className="pt-3 text-center text-[0.8rem] text-black/65">This is taking longer than usual. You can wait or try another tab.</p> : null}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-[0.92rem] text-black/80">No pair sold at two or more stores is in stock under {formatInr(band)} right now.</p>
        ) : (
          <>
            <ul>
              {items.map((it, i) => (
                <Row key={`${it.styleCode}-${it.size}`} item={it} rank={i + 1} />
              ))}
            </ul>
            <p className="pt-3 text-center text-[0.74rem] text-black/65">{RANK_NOTE}</p>
          </>
        )}
      </div>
    </section>
  );
}
