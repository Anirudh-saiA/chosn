'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { ArrowUpRight, Copy } from 'lucide-react';
import { fetchCatalogVariant, fetchSearch, formatInr, formatSize, type CatalogOffer, type SearchResultItem, type StoreOffer } from '@/lib/catalog';
import { formatDelivery, isEligible } from '@/lib/recommend';

// Pure black and white, Inter, no gradients (founder rule, 2026-10-27). The font is scoped to this block.
const inter = Inter({ subsets: ['latin'], display: 'swap' });

const BANDS = [5000, 10000, 15000, 20000] as const;
type Band = (typeof BANDS)[number];
const PAGE = 12;
type Order = 'price' | 'compared';
const ORDERS: Array<[Order, string, string]> = [
  ['price', 'Cheapest', 'price_asc'],
  ['compared', 'Most compared', 'stores'],
];

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

/** What the page learned about one shoe: the cheapest in-stock store for its default size and the offers that store lists. */
interface Best {
  offer: CatalogOffer;
  size: number;
  storeCount: number;
}
type BestState = Best | 'none' | 'error';

const bestCache = new Map<string, BestState>();

async function loadBest(item: SearchResultItem): Promise<BestState> {
  const key = `${item.styleCode}/${item.defaultSize}`;
  const hit = bestCache.get(key);
  if (hit) return hit;
  try {
    const data = await fetchCatalogVariant(item.styleCode, item.defaultSize);
    const live = (data?.offers ?? []).filter(isEligible).sort((a, b) => (a.effectivePriceInr as number) - (b.effectivePriceInr as number));
    const out: BestState = live[0] ? { offer: live[0], size: item.defaultSize, storeCount: live.length } : 'none';
    bestCache.set(key, out);
    return out;
  } catch {
    return 'error';
  }
}

function shortDate(iso?: string): string | null {
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
      className="relative inline-flex items-center gap-1.5 rounded-md border border-dashed border-black px-2 py-0.5 font-semibold tracking-wide text-black before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] hover:bg-black hover:text-white"
    >
      {code} <Copy className="h-3 w-3" aria-hidden /> {done && <span className="text-[0.7rem] font-medium">copied</span>}
    </button>
  );
}

function OfferLine({ o }: { o: StoreOffer }) {
  const seen = shortDate(o.seenAt);
  return (
    <li className="text-[0.86rem] leading-snug text-black">
      <span className="mr-2 inline-block rounded border border-black px-1.5 py-px text-[0.66rem] font-semibold uppercase tracking-wider">{KIND_LABEL[o.kind] ?? 'Offer'}</span>
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

function Row({ item, best }: { item: SearchResultItem; best: BestState | undefined }) {
  const loaded = best && best !== 'error' && best !== 'none' ? best : null;
  const price = loaded ? (loaded.offer.effectivePriceInr as number) : item.bestAvailablePrice;
  const delivery = loaded ? formatDelivery(loaded.offer) : null;
  const offers = loaded?.offer.offers ?? [];
  const href = `/sneakers/${encodeURIComponent(item.styleCode)}/${loaded?.size ?? item.defaultSize}`;
  const shown = offers.slice(0, 3);
  const rest = offers.slice(3);

  return (
    <li className="border-b border-black/15 py-5 last:border-b-0">
      <div className="flex gap-4">
        <Link href={href} className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-black/15 bg-white sm:h-24 sm:w-24">
          {item.primaryImageUrl ? <img src={item.primaryImageUrl} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-contain p-1.5" /> : null}
          <span className="sr-only">{item.brand} {item.model}</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[0.74rem] font-semibold uppercase tracking-wider text-black/65">{item.brand}</p>
          <Link href={href} className="block text-[1.02rem] font-bold leading-snug text-black hover:underline">
            {item.model}
          </Link>
          <p className="truncate text-[0.82rem] text-black/65">{item.colorway} · UK {formatSize(loaded?.size ?? item.defaultSize)}</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-[1.65rem] font-extrabold leading-none tabular-nums text-black">{price !== null && price !== undefined ? formatInr(price) : '—'}</p>
            <p className="text-[0.82rem] text-black/80">
              {loaded ? <span className="font-semibold text-black">{loaded.offer.retailerName}</span> : best === 'error' ? 'Could not load the store' : best === 'none' ? 'No store in stock in this size' : 'Loading the store…'}
              {loaded && loaded.storeCount > 1 ? ` · cheapest of ${loaded.storeCount} stores` : ''}
            </p>
          </div>
          {loaded && (
            <p className="mt-1 text-[0.74rem] text-black/65">
              {delivery ? `Delivery ${delivery} (the store's own estimate)` : 'Delivery not published'}
            </p>
          )}
        </div>
        {loaded && (
          <a
            href={loaded.offer.listingUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            aria-label={`Buy at ${loaded.offer.retailerName} for ${formatInr(price as number)} (opens in a new tab)`}
            className="hidden min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-full bg-black px-5 text-[0.78rem] font-bold uppercase tracking-wider text-white hover:bg-black/80 sm:inline-flex"
          >
            Buy <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>

      {loaded && (
        <div className="mt-3 rounded-xl border border-black/15 p-3.5 sm:ml-28">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-black/65">
            Coupons and offers at {loaded.offer.retailerName}
          </p>
          {offers.length === 0 ? (
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
      )}

      {loaded && (
        <a
          href={loaded.offer.listingUrl}
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label={`Buy at ${loaded.offer.retailerName} for ${formatInr(price as number)} (opens in a new tab)`}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-black px-5 text-[0.78rem] font-bold uppercase tracking-wider text-white hover:bg-black/80 sm:hidden"
        >
          Buy at {loaded.offer.retailerName} <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      )}
    </li>
  );
}

/**
 * "Shop by budget": sneakers under ₹5,000 / ₹10,000 / ₹15,000 / ₹20,000, cheapest first, each with the cheapest in-stock store and the coupons
 * and offers that store publishes (code, conditions, date seen, source). Nothing is calculated: we never show a "price after coupon".
 * Built to sit inside the Releases > Drops tab; it fetches its own data in the browser, so the page needs no change besides placing it.
 */
export function BudgetShelf() {
  const [band, setBand] = useState<Band>(5000);
  const [limit, setLimit] = useState(PAGE);
  const [order, setOrder] = useState<Order>('price');
  const [items, setItems] = useState<SearchResultItem[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState<Partial<Record<Band, number>>>({});
  const [best, setBest] = useState<Record<string, BestState>>({});
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // The count on each tab (one small request per band).
  useEffect(() => {
    let live = true;
    for (const b of BANDS) {
      fetchSearch({ maxPrice: String(b), limit: '1' })
        .then((r) => live && setCounts((c) => ({ ...c, [b]: r.total })))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, []);

  // The shoes for the open tab.
  useEffect(() => {
    let live = true;
    setFailed(false);
    fetchSearch({ maxPrice: String(band), sort: ORDERS.find((o) => o[0] === order)![2], limit: String(limit) })
      .then((r) => {
        if (!live) return;
        setItems(r.results);
        setTotal(r.total);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [band, limit, order]);

  // Each shoe's cheapest store and its offers: a few at a time so the API is not hit with a burst.
  useEffect(() => {
    if (!items) return;
    let live = true;
    const todo = items.filter((it) => !(`${it.styleCode}/${it.defaultSize}` in best));
    let next = 0;
    const worker = async () => {
      while (live && next < todo.length) {
        const it = todo[next++]!;
        const state = await loadBest(it);
        if (live) setBest((b) => ({ ...b, [`${it.styleCode}/${it.defaultSize}`]: state }));
      }
    };
    void Promise.all([worker(), worker(), worker()]);
    return () => {
      live = false;
    };
    // `best` is read only to skip shoes that are already loaded.
  }, [items]);

  const pick = useCallback((b: Band) => {
    setBand(b);
    setLimit(PAGE);
    setItems(null);
    setTotal(null);
  }, []);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + BANDS.length) % BANDS.length;
    pick(BANDS[n]!);
    tabRefs.current[n]?.focus();
  };

  return (
    <section aria-labelledby="budget-h" className={`${inter.className} mx-auto w-full max-w-3xl rounded-2xl border border-black bg-white p-5 text-black sm:p-7`}>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-black/65">Coupons and offers included</p>
      <h2 id="budget-h" className="mt-1 text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold leading-tight tracking-tight">
        Shop by budget
      </h2>
      <p className="mt-2 max-w-xl text-[0.92rem] leading-relaxed text-black/80">
        The cheapest in-stock store for each pair, with the coupons and offers that store lists. Prices are in rupees and come from the stores&apos; own pages.
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
              onClick={() => pick(b)}
              onKeyDown={(e) => onKey(e, i)}
              className={`min-h-[52px] rounded-xl border px-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                on ? 'border-black bg-black text-white' : 'border-black bg-white text-black hover:bg-black/5'
              }`}
            >
              <span className="block text-[0.95rem] font-bold leading-tight">Under {formatInr(b)}</span>
              <span className={`block text-[0.72rem] ${on ? 'text-white/80' : 'text-black/65'}`}>{counts[b] !== undefined ? `${counts[b]!.toLocaleString('en-IN')} pairs` : ' '}</span>
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Order the list" className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-black/65">Order</span>
        {ORDERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={order === id}
            onClick={() => {
              setOrder(id);
              setLimit(PAGE);
              setItems(null);
              setTotal(null);
            }}
            className={`min-h-[44px] rounded-full border border-black px-4 text-[0.8rem] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${order === id ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/5'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="budget-panel" role="tabpanel" aria-labelledby={`budget-tab-${band}`} className="mt-3" aria-busy={items === null && !failed}>
        {failed ? (
          <p className="py-8 text-center text-[0.92rem] text-black/80">Could not load this budget right now. Please try again in a moment.</p>
        ) : items === null ? (
          <p className="py-8 text-center text-[0.92rem] text-black/65">Loading pairs under {formatInr(band)}…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-[0.92rem] text-black/80">No pair is in stock under {formatInr(band)} right now.</p>
        ) : (
          <>
            <ul>
              {items.map((it) => (
                <Row key={`${it.styleCode}-${it.defaultSize}`} item={it} best={best[`${it.styleCode}/${it.defaultSize}`]} />
              ))}
            </ul>
            {total !== null && items.length < total && (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + PAGE)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-black px-6 text-[0.82rem] font-bold uppercase tracking-wider text-black hover:bg-black hover:text-white"
                >
                  Show {Math.min(PAGE, total - items.length)} more
                </button>
                <p className="mt-2 text-[0.74rem] text-black/65">
                  Showing {items.length} of {total.toLocaleString('en-IN')}, {order === 'price' ? 'cheapest first' : 'most compared first'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
