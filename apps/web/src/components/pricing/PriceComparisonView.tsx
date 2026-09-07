'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCatalogVariant, formatSize, type CatalogResponse } from '@/lib/catalog';
import { AffiliateDisclosure } from './AffiliateDisclosure';
import { MarketIntelligenceCard } from './MarketIntelligenceCard';
import { OfferTable } from './OfferTable';
import { SizeSelector } from './SizeSelector';

export interface PriceComparisonViewProps {
  styleCode: string;
  initialData: CatalogResponse;
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
export function PriceComparisonView({ styleCode, initialData }: PriceComparisonViewProps) {
  const [data, setData] = useState(initialData);
  const [pendingSize, setPendingSize] = useState<number | null>(null);
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
    // `data.siblingSizes` — this project doesn't run the react-hooks
    // lint rule, but the intent is the same as satisfying it manually:
    // re-run once per size change, not on every render.
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

  return (
    <div className="flex flex-col gap-6">
      <MarketIntelligenceCard data={data.marketIntelligence} bestRetailerName={bestRetailerName} />

      <div>
        <p className="mb-2 font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
          Size
        </p>
        <SizeSelector
          sizes={data.siblingSizes}
          currentSize={data.variant.size}
          pendingSize={pendingSize}
          onSelect={handleSelect}
          onPrefetch={load}
        />
      </div>

      <div>
        <OfferTable offers={data.offers} />
        <AffiliateDisclosure />
      </div>
    </div>
  );
}
