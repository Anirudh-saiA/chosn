import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { INDIA_STATUS_LABEL, type DropDetail } from '@/lib/drops';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "Coming to India?": whether the pair is already in Indian stores (with a compare link), an estimate of its Indian price, and where it usually lands. */
export function IndiaPanel({ drop }: { drop: DropDetail }) {
  const stores = drop.inIndianStores ?? [];
  const carriers = drop.storesThatCarryBrand ?? [];
  const est = drop.priceEstimate;
  return (
    <section aria-labelledby="india-h" className="panel flex flex-col gap-3 p-5">
      <h2 id="india-h" className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">
        {INDIA_STATUS_LABEL[drop.indiaStatus ?? 'unknown']}
      </h2>
      {stores.length > 0 ? (
        <>
          <ul className="flex flex-col gap-1.5 text-body text-text">
            {stores.map((s) => (
              <li key={s.slug} className="flex items-center justify-between gap-3">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-brass-bright hover:underline">
                  {s.name}
                </a>
                <span className="font-mono">{rupees(s.price)}</span>
              </li>
            ))}
          </ul>
          {drop.defaultVariant && (
            <Link href={`/sneakers/${encodeURIComponent(drop.sneaker.styleCode)}/${drop.defaultVariant.size}`} className="inline-flex min-h-[44px] items-center gap-1.5 font-mono text-meta text-brass-bright underline-offset-4 hover:underline">
              Compare these prices <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </>
      ) : (
        <p className="text-meta text-text-soft">No Indian store we read lists this pair yet.</p>
      )}
      {est ? (
        <p className="text-meta text-text-soft">
          Estimate: similar pairs in Indian stores today ({est.pairs} pairs) cost {rupees(est.low)} to {rupees(est.high)}, typically {rupees(est.median)}. This is an estimate from our own data, not the official price.
        </p>
      ) : null}
      {carriers.length > 0 && stores.length === 0 ? (
        <p className="text-meta text-text-soft">
          Stores that carry {drop.sneaker.brand} most: {carriers.map((s) => s.name).join(', ')}.
        </p>
      ) : null}
    </section>
  );
}
