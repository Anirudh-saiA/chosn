'use client';

import { useState } from 'react';
import { ChevronDown, Info, X } from 'lucide-react';
import { StoreRow } from './StoreRow';
import { buildBuyGuide } from '@/lib/buy-guide';
import { formatInr, type CatalogOffer } from '@/lib/catalog';
import { deliveryDays, isEligible, scoreOffers } from '@/lib/recommend';

/**
 * Minimal offers section: one "best way to buy" card (lowest price, how to pay, the offers that store lists), then one
 * quiet row per store that opens to show how you can pay, every offer, shipping and returns. Stores whose prices are
 * demo data are not shown as offers; stores that are sold out in this size are named underneath.
 */
export function OfferCards({
  offers,
  size,
  connectedStores = [],
  styleCode,
  sizeNumber,
  shoeName,
  choices = null,
}: {
  offers: CatalogOffer[];
  size: string;
  connectedStores?: Array<{ slug: string; name: string }>;
  styleCode?: string;
  sizeNumber?: number;
  shoeName?: string;
  choices?: { views: number; visitors: number; repeatVisitors: number; clicks: Record<string, number> } | null;
}) {
  const [sortBy, setSortBy] = useState<'value' | 'price' | 'fastest'>('value');
  const byPrice = offers.filter(isEligible).sort((a, b) => (a.effectivePriceInr as number) - (b.effectivePriceInr as number));
  const scores = scoreOffers(byPrice);
  const days = (o: CatalogOffer) => deliveryDays(o);
  const score = (o: CatalogOffer) => scores.get(o.retailerSlug)?.score ?? 0;
  // The order the stores are listed in: best value (default), lowest price, or fastest stated delivery.
  const live = [...byPrice].sort((a, b) => {
    if (sortBy === 'price') return (a.effectivePriceInr as number) - (b.effectivePriceInr as number);
    if (sortBy === 'fastest') return (days(a) ?? 99) - (days(b) ?? 99) || (a.effectivePriceInr as number) - (b.effectivePriceInr as number);
    return score(b) - score(a) || (a.effectivePriceInr as number) - (b.effectivePriceInr as number);
  });
  const soldOut = offers.filter((o) => o.mode !== 'fixture' && !isEligible(o));
  const demo = offers.filter((o) => o.mode === 'fixture');

  // Stores we read that cannot sell this size: grey crossed buttons under the offers. "Sold out" = the store lists the size but has none;
  // otherwise the store does not list this size (or shoe) at all.
  const liveSlugs = new Set(live.map((o) => o.retailerSlug));
  const soldOutSlugs = new Set(soldOut.map((o) => o.retailerSlug));
  const without = connectedStores.filter((s) => !liveSlugs.has(s.slug));
  const chips = (
    <ul className="flex flex-wrap gap-2">
      {without.map((s) => (
        <li
          key={s.slug}
          title={soldOutSlugs.has(s.slug) ? `${s.name} has UK ${size} listed but it is sold out` : `${s.name} does not list UK ${size} of this shoe`}
          className="inline-flex items-center gap-1.5 rounded-full border border-text/10 bg-text/[0.05] px-3.5 py-1.5 text-[0.82rem] text-text-faint"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          <span className="line-through decoration-text/30">{s.name}</span>
          <span className="sr-only">{soldOutSlugs.has(s.slug) ? 'sold out' : 'not listed'}</span>
        </li>
      ))}
    </ul>
  );
  // Up to four stores are shown as buttons; more than that folds into one line that opens to show them (a one-store shoe would
  // otherwise get a wall of grey).
  const crossed = without.length > 0 && (
    <div className="mt-5">
      {without.length <= 4 ? (
        <>
          <p className="mb-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-text-faint">Not available in UK {size}</p>
          {chips}
        </>
      ) : (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-text/10 bg-text/[0.05] px-3.5 py-1.5 text-[0.82rem] text-text-faint transition-colors hover:border-text/25 [&::-webkit-details-marker]:hidden">
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Not available at {live.length > 0 ? `${without.length} other` : `all ${without.length}`} stores in UK {size}
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3">{chips}</div>
        </details>
      )}
    </div>
  );

  if (live.length === 0) {
    return (
      <div>
        <div className="rounded-2xl border border-text/10 bg-white p-8 text-center">
          <p className="text-[1.05rem] font-semibold text-text">No connected store has UK {size} in stock right now.</p>
          <p className="mt-2 text-[0.9rem] text-text-soft">Pick another size above. Sizes with a line through them are sold out everywhere.</p>
        </div>
        {crossed}
      </div>
    );
  }

  const guide = buildBuyGuide(offers);
  const min = byPrice[0]?.effectivePriceInr as number;
  const known = live.filter((o) => deliveryDays(o) !== null);
  const fastest = known.length > 1 ? known.reduce((a, b) => ((deliveryDays(b) as number) < (deliveryDays(a) as number) ? b : a)) : null;
  const minDays = fastest ? (deliveryDays(fastest) as number) : 0;
  const bestValue = byPrice.length > 1 ? [...byPrice].sort((a, b) => score(b) - score(a) || (a.effectivePriceInr as number) - (b.effectivePriceInr as number))[0] : null;
  const labelsFor = (o: CatalogOffer) => {
    const l: string[] = [];
    if (bestValue && o.retailerSlug === bestValue.retailerSlug) l.push('Best value');
    if (o.retailerSlug === byPrice[0]?.retailerSlug && byPrice.length > 1) l.push('Lowest price');
    if (fastest && o.retailerSlug === fastest.retailerSlug) l.push('Fastest');
    return l;
  };

  return (
    <div>
      {guide && (
        <section aria-labelledby="guide-h" className="mb-6 rounded-2xl border border-text/10 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p id="guide-h" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-text-faint">
                Cheapest way to buy · UK {size}
              </p>
              <p className="mt-1.5 font-mono text-[clamp(2rem,5vw,2.8rem)] font-extrabold leading-none tabular-nums text-text">{formatInr(guide.price)}</p>
            </div>
            {guide.maxExtraSaving > 0 && <p className="text-[0.92rem] text-text-soft">Offers listed by {guide.best.retailerName} can take up to {formatInr(guide.maxExtraSaving)} more off.</p>}
          </div>
          <ol className="mt-5 space-y-4">
            {guide.steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#14213D] font-mono text-[0.72rem] font-bold text-white">{i + 1}</span>
                <div>
                  <p className="text-[1.02rem] font-semibold leading-snug text-text">{s.title}</p>
                  {s.lines.map((l) => (
                    <p key={l} className="mt-0.5 text-[0.88rem] leading-snug text-text-soft">
                      {l}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          {!guide.anyBankOrCardOffer && (
            <p className="mt-5 flex items-start gap-2 text-[0.8rem] leading-relaxed text-text-faint">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>These stores do not publish bank or credit-card offers on their pages. If one shows on the payment page after you log in, it comes on top of this price.</span>
            </p>
          )}
        </section>
      )}

      {live.length > 1 && (
        <div className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-text-faint">Where to buy · sort stores by</p>
            <div role="group" aria-label="Sort stores" className="flex overflow-hidden rounded-full border border-text/15">
              {(
                [
                  ['value', 'Best value'],
                  ['price', 'Lowest price'],
                  ['fastest', 'Fastest'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={sortBy === id}
                  onClick={() => setSortBy(id)}
                  className={`min-h-[34px] px-3.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.08em] transition-colors ${sortBy === id ? 'bg-[#14213D] text-white' : 'text-text-soft hover:bg-text/5 hover:text-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <details className="mt-2 text-[0.8rem] text-text-soft">
            <summary className="cursor-pointer select-none font-semibold text-text-soft hover:text-text">How the Value score works</summary>
            <p className="mt-2 max-w-3xl leading-relaxed">
              It weighs what matters to a shopper: the total price with shipping (55%), how soon it arrives by the store&apos;s own published estimate (30%) and how
              easy returns are by the store&apos;s own policy (15%). Where a store has reviews we can cite, reviews count 20% and the others shrink to fit. Only
              Myntra shows ratings today; for other stores we say so and don&apos;t guess. Nothing is predicted: every number comes from the stores&apos; own pages.
            </p>
            <p className="mt-2 max-w-3xl leading-relaxed">
              Where it shows &quot;N shoppers chose this store for this shoe&quot;, that is an anonymous count of people who pressed Buy at that store for this exact
              shoe in the last 90 days. It shows what shoppers picked, not how the order went, and the order of the list nudges it, so we show it as a count and
              do not fold it into the Value score.
            </p>
          </details>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {live.map((o, i) => {
          const d = deliveryDays(o);
          return (
            <StoreRow
              key={o.retailerSlug}
              offer={o}
              min={min}
              isBest={i === 0}
              fastest={fastest?.retailerSlug === o.retailerSlug}
              defaultOpen={false}
              labels={labelsFor(o)}
              value={live.length > 1 && scores.get(o.retailerSlug) ? { score: score(o), note: scores.get(o.retailerSlug)!.note } : undefined}
              slowerDays={d !== null && fastest ? Math.max(0, d - minDays) : 0}
              track={styleCode ? { styleCode, size: sizeNumber, position: i, sort: sortBy, shoeName } : undefined}
              chosenBy={choices?.clicks[o.retailerSlug] ?? 0}
            />
          );
        })}
      </ul>

      {crossed}

      {demo.length > 0 && (
        <div className="mt-4 space-y-1 text-[0.84rem] text-text-soft">
          {demo.length > 0 && (
            <p>
              <strong className="text-text">Not connected yet:</strong> {demo.map((o) => o.retailerName).join(', ')} (placeholder prices, not shown as offers).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
