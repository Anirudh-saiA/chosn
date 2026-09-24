'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { Reveal } from '@/components/fx/Reveal';
import { PriceChart, makeSeries } from '@/components/ui/PriceChart';
import { SneakerViewer } from '@/components/ui/SneakerViewer';
import { fetchCatalogVariant, formatInr, formatSize, type CatalogResponse } from '@/lib/catalog';
import { paletteFor } from '@/lib/sneaker/palette';
import { AffiliateDisclosure } from './AffiliateDisclosure';
import { MarketIntelligenceCard } from './MarketIntelligenceCard';
import { findBestOffer, OfferTable } from './OfferTable';
import { SizeSelector } from './SizeSelector';

export interface PriceComparisonViewProps {
  styleCode: string;
  initialData: CatalogResponse;
  /** Real product image (resolveSneakerImage) — replaces the 3D stage when present. */
  imageUrl?: string | null;
  /** Server-rendered extras slotted next to the brand eyebrow (drop badge). */
  badges?: ReactNode;
  /** Server-rendered notify controls. */
  notify?: ReactNode;
}

/**
 * Owns the one piece of client state this page needs: which variant is
 * currently shown. The initial render is whatever page.tsx fetched
 * server-side (real SSR, real HTML, indexable — Day 10 task 2); after
 * that, switching sizes updates this component's state directly instead
 * of triggering a Next.js navigation.
 *
 * That's a deliberate choice, not a shortcut: a route change remounts
 * page.tsx's subtree, which would reset TweenedPrice's "previous value"
 * ref on every switch and make the number-tween (task 5) impossible —
 * there'd be nothing to animate from. Updating state in place keeps
 * TweenedPrice mounted across a size change, which is what gives the
 * tween a real old value to animate from. The URL still updates (via
 * history.replaceState, not pushState/router.push, so switching sizes
 * doesn't pile up back-button stops) so the address bar and any
 * copy-pasted link stay correct — it just doesn't ask Next to refetch
 * and re-render the segment, since the data's already in hand.
 */
export function PriceComparisonView({ styleCode, initialData, imageUrl, badges, notify }: PriceComparisonViewProps) {
  const [data, setData] = useState(initialData);
  const [pendingSize, setPendingSize] = useState<number | null>(null);
  const [range, setRange] = useState<30 | 90>(90);
  const [narrow, setNarrow] = useState(false);
  const cache = useRef(new Map<number, CatalogResponse>([[initialData.variant.size, initialData]]));
  const inFlight = useRef(new Map<number, Promise<CatalogResponse | null>>());

  const load = useCallback(
    (size: number): Promise<CatalogResponse | null> => {
      const cached = cache.current.get(size);
      if (cached) return Promise.resolve(cached);

      let promise = inFlight.current.get(size);
      if (!promise) {
        promise = fetchCatalogVariant(styleCode, size).then((result) => {
          inFlight.current.delete(size);
          if (result) cache.current.set(size, result);
          return result;
        });
        inFlight.current.set(size, promise);
      }
      return promise;
    },
    [styleCode],
  );

  // The chart is drawn in an 800-unit viewBox, so on phones it needs more
  // height to keep its plotted area legible.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Adjacent sizes only (task 7 says "adjacent," not "every size") —
  // fetched once on mount so the common case (one step up or down) is
  // already cached by the time anyone clicks.
  useEffect(() => {
    const sizes = data.siblingSizes.map((s) => s.size).sort((a, b) => a - b);
    const idx = sizes.indexOf(data.variant.size);
    [sizes[idx - 1], sizes[idx + 1]].forEach((s) => {
      if (typeof s === 'number') void load(s);
    });
    // Deliberately keyed on data.variant.size alone, not on `load` or
    // `data.siblingSizes` — the intent is to re-run once per size
    // change, not on every render.
  }, [data.variant.size]);

  const handleSelect = useCallback(
    async (size: number) => {
      if (size === data.variant.size) return;
      setPendingSize(size);
      const result = await load(size);
      setPendingSize(null);
      if (!result) return; // shouldn't happen for a size the page itself listed as a sibling
      setData(result);
      window.history.replaceState(null, '', `/sneakers/${styleCode}/${formatSize(size)}`);
    },
    [data.variant.size, load, styleCode],
  );

  const bestRetailerName =
    data.offers.find((o) => o.retailerSlug === data.marketIntelligence?.bestRetailerSlug)
      ?.retailerName ?? data.marketIntelligence?.bestRetailerSlug ?? null;

  const { sneaker, marketIntelligence: mi } = data;
  const palette = useMemo(() => paletteFor(sneaker.colorway, sneaker.brand), [sneaker.colorway, sneaker.brand]);
  const bestOffer = findBestOffer(data.offers);
  const chartPrice = mi?.currentPrice ?? mi?.bestAvailablePrice ?? null;
  const series = useMemo(
    () =>
      chartPrice != null
        ? makeSeries({
            current: chartPrice,
            avg30: mi?.avg30d,
            avg90: mi?.avg90d,
            seed: `${styleCode}-${data.variant.size}`,
          })
        : [],
    [chartPrice, mi?.avg30d, mi?.avg90d, styleCode, data.variant.size],
  );
  const shown = range === 30 ? series.slice(-30) : series;
  const accent = mi?.signal === 'good_time_to_buy' ? 'signal' : mi?.signal === 'consider_waiting' ? 'rust' : 'brass';

  return (
    <div className="flex flex-col gap-10 pb-24 md:pb-0 lg:gap-14">
      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* Stage */}
        <div className="panel ticks relative h-[360px] self-start overflow-hidden sm:h-[460px] lg:sticky lg:top-24 lg:h-[560px]">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `radial-gradient(55% 50% at 50% 58%, ${palette.glow}40, transparent 72%)` }}
          />
          <div aria-hidden className="grid-lines !opacity-40" />
          <span className="absolute left-4 top-4 z-10 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-text-faint">
            {imageUrl ? 'Product view' : '3D view'} / UK {formatSize(data.variant.size)}
          </span>
          <span className="absolute right-4 top-4 z-10 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-brass">
            {sneaker.styleCode}
          </span>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${sneaker.brand} ${sneaker.model} ${sneaker.colorway}`}
              className="absolute inset-0 h-full w-full object-contain p-10"
            />
          ) : (
            <div className="absolute inset-0">
              <SneakerViewer brand={sneaker.brand} model={sneaker.model} colorway={sneaker.colorway} />
            </div>
          )}
        </div>

        {/* Readout */}
        <div className="flex min-w-0 flex-col gap-6">
          <Reveal y={16}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow">{sneaker.brand}</p>
              <span className="border border-text/15 bg-vault-raised/70 px-2.5 py-1 font-mono text-meta tracking-[0.06em] text-text-soft">
                {sneaker.styleCode}
              </span>
              {badges}
            </div>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[0.98] tracking-tight text-text">
              {sneaker.model}
            </h1>
            <p className="mt-2 text-lg text-text-soft">{sneaker.colorway}</p>
          </Reveal>

          <MarketIntelligenceCard data={data.marketIntelligence} bestRetailerName={bestRetailerName} />

          <div>
            <p className="mb-2.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-text-faint">Size</p>
            <SizeSelector
              sizes={data.siblingSizes}
              currentSize={data.variant.size}
              pendingSize={pendingSize}
              onSelect={handleSelect}
              onPrefetch={load}
            />
          </div>

          {notify && (
            <div className="border-t border-text/[0.08] pt-5">
              <p className="mb-2.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-text-faint">Drop alerts</p>
              {notify}
            </div>
          )}
        </div>
      </div>

      {series.length > 0 && (
        <Reveal>
          <section aria-labelledby="chart-h" className="panel ticks p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Trend</p>
                <h2 id="chart-h" className="mt-2 font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
                  Price history
                </h2>
              </div>
              <div role="group" aria-label="Chart range" className="flex border border-text/15">
                {([30, 90] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={range === r}
                    onClick={() => setRange(r)}
                    className={`min-h-[44px] min-w-[64px] px-4 font-mono text-data-delta transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass-bright ${
                      range === r
                        ? 'bg-brass-gradient font-semibold text-vault-deep'
                        : 'text-text-soft hover:bg-vault-high hover:text-text'
                    }`}
                  >
                    {r}D
                  </button>
                ))}
              </div>
            </div>
            <PriceChart
              key={`${range}-${data.variant.size}`}
              series={shown}
              avg30={mi?.avg30d}
              avg90={range === 90 ? mi?.avg90d : null}
              accent={accent}
              height={narrow ? 520 : 300}
            />
            <p className="mt-3 font-mono text-meta text-text-faint">
              Illustrative trend interpolated from the 30- and 90-day averages and today&apos;s price — not raw daily
              ticks.
            </p>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section aria-labelledby="offers-h">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Retailers</p>
              <h2 id="offers-h" className="mt-2 font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
                Compare offers
              </h2>
            </div>
            <p className="font-mono text-meta text-text-soft">
              UK {formatSize(data.variant.size)} · {data.offers.length}{' '}
              {data.offers.length === 1 ? 'retailer' : 'retailers'}
            </p>
          </div>
          <OfferTable offers={data.offers} />
          <AffiliateDisclosure />
        </section>
      </Reveal>

      {bestOffer && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-brass/30 bg-vault-deep/95 px-5 py-3 backdrop-blur-xl md:hidden">
          <div className="min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass">Best price</p>
            <p className="font-mono text-2xl font-medium leading-none tabular-nums text-text">
              {formatInr(bestOffer.effectivePriceInr as number)}
            </p>
            <p className="mt-0.5 truncate font-mono text-meta text-text-soft">{bestOffer.retailerName}</p>
          </div>
          <a
            href={bestOffer.listingUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            aria-label={`View deal at ${bestOffer.retailerName} (opens in a new tab)`}
            className={buttonVariantClass('primary', 'min-h-[48px] shrink-0 px-5')}
          >
            View deal <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      )}
    </div>
  );
}
