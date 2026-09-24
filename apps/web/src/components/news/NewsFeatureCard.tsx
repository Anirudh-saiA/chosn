import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { SneakerPlaceholderArt } from '@/components/drops/SneakerPlaceholderArt';
import { relativeTime } from '@/lib/catalog';
import { excerpt, type NewsListItem } from '@/lib/news';
import { BreakingPill } from './BreakingPill';

/**
 * The lead story: a materially bigger, differently-composed block than
 * NewsCard (not the same card scaled up) — the one place on the page that
 * gets display-hero treatment.
 */
export function NewsFeatureCard({ item }: { item: NewsListItem }) {
  return (
    <Reveal>
      <Link
        href={`/news/${item.id}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <article className="edge-glow ticks panel grid overflow-hidden transition-colors hover:bg-vault-high lg:grid-cols-[1.1fr_1fr]">
          <div className="relative min-h-[15rem] border-b border-text/[0.08] lg:min-h-[24rem] lg:border-b-0 lg:border-r">
            {item.dropSneaker ? (
              <SneakerPlaceholderArt
                brand={item.dropSneaker.brand}
                model={item.dropSneaker.model}
                colorway=""
                aspect="wide"
                className="!absolute !inset-0 !aspect-auto h-full w-full border-0"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-vault-deep/70">
                <span className="font-display text-6xl font-bold tracking-tight text-text/20">CHOSN</span>
              </div>
            )}
            <p className="eyebrow absolute left-4 top-4 sm:left-6 sm:top-6">Lead story</p>
          </div>
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              {item.isBreaking && <BreakingPill />}
              <p className="font-mono text-meta text-text-faint">
                {item.source} · <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
              </p>
            </div>
            <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.05] tracking-tight text-text transition-colors group-hover:text-brass-bright">
              {item.title}
            </h2>
            <p className="max-w-[60ch] text-lg leading-relaxed text-text-soft">{excerpt(item.body, 220)}</p>
            <span className="inline-flex items-center gap-2 font-sans text-ui-label font-semibold text-brass-bright">
              Read the story <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
            </span>
          </div>
        </article>
      </Link>
    </Reveal>
  );
}
