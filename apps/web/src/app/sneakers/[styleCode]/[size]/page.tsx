import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Masthead } from '@/components/Masthead';
import { PriceComparisonView } from '@/components/pricing/PriceComparisonView';
import { fetchAllVariantParams, fetchCatalogVariant, formatInr, formatSize } from '@/lib/catalog';

interface PageProps {
  params: Promise<{ styleCode: string; size: string }>;
}

/**
 * Server-fetched once per revalidation window, not per request (Day 10
 * task 2) — Next's `fetch` cache with `revalidate` does the ISR here,
 * no getStaticProps/getServerSideProps split to think about under the
 * App Router. 300s: long enough that this doesn't hammer the API on
 * every crawler hit, short enough that a size the pipeline just
 * refreshed shows up within five minutes rather than an hour.
 */
const REVALIDATE_SECONDS = 300;

async function loadVariant(styleCode: string, sizeParam: string) {
  const size = Number(sizeParam);
  if (!Number.isFinite(size) || size <= 0) return null;
  return fetchCatalogVariant(styleCode, size, { next: { revalidate: REVALIDATE_SECONDS } });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { styleCode, size } = await params;
  const data = await loadVariant(styleCode, size);
  if (!data) return { title: 'Not found | CHOSN' };

  const { sneaker, variant, marketIntelligence } = data;
  const title = `${sneaker.brand} ${sneaker.model} "${sneaker.colorway}" · UK ${formatSize(variant.size)} price comparison | CHOSN`;
  const priceLine =
    marketIntelligence?.bestAvailablePrice != null
      ? `Best available: ${formatInr(marketIntelligence.bestAvailablePrice)}.`
      : '';
  const description = `Compare real-time prices for the ${sneaker.brand} ${sneaker.model} "${sneaker.colorway}" (${sneaker.styleCode}) in UK ${formatSize(variant.size)} across ${data.offers.length} retailers. ${priceLine}`;

  return { title, description };
}

// Next requires this literal, not a reference to REVALIDATE_SECONDS above
// — route segment config has to be statically analyzable at build time.
// Keep this in sync with REVALIDATE_SECONDS if that value ever changes.
export const revalidate = 300;

/**
 * Pre-renders every launch-catalog variant at build time — without
 * this, the page built as a Dynamic (ƒ) route (visible in `next build`'s
 * own output) despite `revalidate` being set, and every request paid
 * for a fresh React render even when the underlying data was cache-hit.
 * Day 11's load test caught it: p95 response time under 50 req/s
 * concurrent load was ~2.7s for a page that serves in ~20ms standalone
 * — see load-tests/run-report.md for the before/after numbers.
 *
 * A variant added after a deploy still works — `dynamicParams` defaults
 * to true, so an unlisted param renders (and caches) on its first
 * request rather than 404ing. This only changes which variants are
 * warm on day one, never which variants are reachable.
 */
export async function generateStaticParams() {
  const variants = await fetchAllVariantParams();
  return variants.map((v) => ({ styleCode: v.styleCode, size: formatSize(v.size) }));
}

export default async function SneakerPricePage({ params }: PageProps) {
  const { styleCode, size } = await params;
  const data = await loadVariant(styleCode, size);
  if (!data) notFound();

  const { sneaker, variant } = data;

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-5xl px-6 py-10 lg:py-12">
        <header className="mb-6">
          <p className="font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
            {sneaker.styleCode} · UK {formatSize(variant.size)}
          </p>
          <h1 className="mt-1 font-display text-display-section font-semibold text-text">
            {sneaker.brand} {sneaker.model}
          </h1>
          <p className="text-body text-text-soft">{sneaker.colorway}</p>
        </header>

        <PriceComparisonView styleCode={styleCode} initialData={data} />
      </div>
    </main>
  );
}
