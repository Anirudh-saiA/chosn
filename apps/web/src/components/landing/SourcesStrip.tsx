import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Marquee } from '@/components/fx/Marquee';
import { brandLogoFile } from '@/components/ui/BrandMark';

/**
 * Where the data comes from, kept strictly to what the app really ingests:
 * `RETAILERS` mirrors apps/api/src/retailers (README "Current sources"), and
 * `BRANDS` are the labels in the catalog. A brand being listed here does not
 * mean the brand's own store is a price source - the two groups are labelled
 * separately for that reason. Add a name here only once its adapter exists.
 */
const RETAILERS: Item[] = [
  { name: 'Superkicks', logo: '/stores/superkicks.png' },
  { name: 'Crepdog Crew', logo: '/stores/crepdog-crew.png' },
  { name: 'VegNonVeg', logo: '/stores/vegnonveg.png' },
  { name: 'Mainstreet Marketplace', logo: '/stores/mainstreet-marketplace.png' },
  { name: 'Myntra', logo: '/stores/myntra.png' },
  { name: 'Limited Edt', logo: '/stores/limited-edt.png' },
  { name: 'Puma India', logo: '/stores/puma-india.png' },
  { name: 'Gully Labs', logo: '/stores/gully-labs.png' },
  { name: 'Culture Circle', logo: '/stores/culture-circle.png' },
];
// A brand shows its logo when we have one (public/brands), and just its name otherwise.
const BRANDS: Item[] = ['Nike', 'Jordan', 'adidas', 'Yeezy', 'New Balance', 'Converse', 'Vans', 'ASICS', 'Puma'].map((name) => {
  const file = brandLogoFile(name);
  return { name, logo: file ? `/brands/${file}` : null };
});

interface Item {
  name: string;
  logo: string | null;
}

function Group({ label, items }: { label: string; items: Item[] }) {
  return (
    <>
      <span className="mx-6 shrink-0 rounded-full bg-text px-3.5 py-1.5 font-mono text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#F4F1EA]">
        {label}
      </span>
      {items.map((n) => (
        <span key={n.name} className="flex shrink-0 items-center">
          <span className="flex items-center gap-3 px-6">
            {n.logo && (
              <img src={n.logo} alt="" className="h-8 w-auto max-w-[5.5rem] object-contain" loading="lazy" draggable={false} />
            )}
            <span className="font-display text-[1.7rem] font-bold leading-none tracking-tight text-text">{n.name}</span>
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
          href="/stores"
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-text-soft transition-colors hover:text-text"
        >
          How we source data <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="glass-frost overflow-hidden rounded-full py-4">
        <Marquee duration={38} repeat={2}>
          <Group label="Retailers" items={RETAILERS} />
          <Group label="Brands we track" items={BRANDS} />
        </Marquee>
      </div>
    </section>
  );
}
