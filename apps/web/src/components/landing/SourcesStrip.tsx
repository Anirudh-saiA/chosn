import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Marquee } from '@/components/fx/Marquee';

/**
 * Where the data comes from, kept strictly to what the app really ingests:
 * `RETAILERS` mirrors apps/api/src/retailers (README "Current sources"), and
 * `BRANDS` are the labels in the catalog. A brand being listed here does not
 * mean the brand's own store is a price source - the two groups are labelled
 * separately for that reason. Add a name here only once its adapter exists.
 */
const RETAILERS = ['Flipkart', 'Myntra', 'Ajio', 'END. Clothing', 'Superkicks', 'VegNonVeg'];
const BRANDS = ['Nike', 'Jordan', 'adidas', 'Yeezy', 'New Balance', 'Converse', 'Vans', 'ASICS', 'Puma'];

function Group({ label, names }: { label: string; names: string[] }) {
  return (
    <>
      <span className="mx-6 shrink-0 rounded-full bg-text px-3.5 py-1.5 font-mono text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#F4F1EA]">
        {label}
      </span>
      {names.map((n) => (
        <span key={n} className="flex shrink-0 items-center">
          <span className="px-6 font-display text-[1.7rem] font-bold leading-none tracking-tight text-text">
            {n}
          </span>
          <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-brass" />
        </span>
      ))}
    </>
  );
}

/** A slim, slowly scrolling band mid-page: the retailers we read prices from, then the brands we track. */
export function SourcesStrip() {
  return (
    <section aria-label="Where our prices come from" className="mx-auto w-full max-w-[90rem] px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-2 pb-4">
        <p className="font-mono text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-text">Where our prices come from</p>
        <Link
          href="/transparency"
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-text-soft transition-colors hover:text-text"
        >
          How we source data <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="glass-frost overflow-hidden rounded-full py-4">
        <Marquee duration={38} repeat={2}>
          <Group label="Retailers" names={RETAILERS} />
          <Group label="Brands we track" names={BRANDS} />
        </Marquee>
      </div>
    </section>
  );
}
