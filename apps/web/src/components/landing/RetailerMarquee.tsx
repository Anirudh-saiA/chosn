import { Marquee } from '@/components/fx/Marquee';

const RETAILERS = ['Flipkart', 'Myntra', 'Ajio', 'END. Clothing', 'Culture Circle', 'Superkicks', 'VegNonVeg', 'Adidas India'];

/** Retailer strip between hero and story. Text wordmarks only — no third-party logos. */
export function RetailerMarquee() {
  return (
    <section aria-label="Retailers we compare" className="relative border-y border-text/[0.07] bg-vault-deep/60 py-6 backdrop-blur-sm">
      <p className="mb-4 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-text-faint">Comparing prices across</p>
      <Marquee duration={45}>
        {RETAILERS.map((r) => (
          <span key={r} className="flex items-center">
            <span className="px-10 font-display text-3xl font-semibold tracking-tight text-text-soft/70 transition-colors hover:text-text sm:text-4xl">
              {r}
            </span>
            <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-brass" />
          </span>
        ))}
      </Marquee>
    </section>
  );
}
