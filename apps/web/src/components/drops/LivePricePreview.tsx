import Link from 'next/link';
import { buttonVariantClass } from '@chosn/ui';
import { fetchCatalogVariant, formatSize } from '@/lib/catalog';
import { MarketIntelligenceCard } from '@/components/pricing/MarketIntelligenceCard';

/**
 * Feature 2 + Feature 3 connect here (Day 15 task 3, the actual point
 * of today's work): once a drop is genuinely live, show where it's
 * already reselling, reusing Day 10's own card rather than a second
 * price-display component.
 *
 * "Only show once real price data exists" — not "once the drop is
 * live." A drop can flip live and have zero price_snapshots for
 * several minutes (the fetch pipeline hasn't run yet, or every source
 * happens to be between cycles) — rendering an empty/zeroed
 * MarketIntelligenceCard in that gap would look like a bug, not an
 * honest "nothing yet." So this fetches the real catalog data server-
 * side and renders nothing at all unless at least one real price
 * exists, rather than rendering the card in a perpetual loading state.
 */
export async function LivePricePreview({ styleCode, size }: { styleCode: string; size: number }) {
  const data = await fetchCatalogVariant(styleCode, size, { next: { revalidate: 60 } });
  const mi = data?.marketIntelligence;
  const hasRealData = mi != null && (mi.currentPrice != null || mi.bestAvailablePrice != null);

  if (!data || !hasRealData) return null;

  const bestRetailerName =
    data.offers.find((o) => o.retailerSlug === mi.bestRetailerSlug)?.retailerName ?? mi.bestRetailerSlug ?? null;

  return (
    <div>
      <p className="mb-2 font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
        This just dropped — here's where it's already reselling
      </p>
      <MarketIntelligenceCard data={mi} bestRetailerName={bestRetailerName} />
      <Link
        href={`/sneakers/${encodeURIComponent(styleCode)}/${formatSize(size)}`}
        className={buttonVariantClass('secondary', 'mt-4 w-full sm:w-auto')}
      >
        Compare every retailer
      </Link>
    </div>
  );
}
