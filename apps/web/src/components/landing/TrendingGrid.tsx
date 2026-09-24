import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { SneakerTile } from '@/components/ui/SneakerTile';
import type { SearchResultItem } from '@/lib/catalog';

export function TrendingGrid({ items }: { items: SearchResultItem[] }) {
  if (items.length === 0) return null;
  return (
    <section data-stage="trending" className="relative py-24 sm:py-32" aria-labelledby="trending-h">
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <p className="eyebrow">Right now</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 id="trending-h" className="mt-3 font-display text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1] tracking-tight text-text">
                Good time to buy
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <Link href="/sneakers" className="link-underline group inline-flex items-center gap-2 font-sans text-ui-label font-semibold text-text">
              Browse the full catalog
              <ArrowRight className="h-4 w-4 text-brass transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 8).map((item, i) => (
            <Reveal as="li" key={item.styleCode} delay={(i % 4) * 0.07}>
              <SneakerTile item={item} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
