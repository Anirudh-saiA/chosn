import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { SneakerPlaceholderArt } from '@/components/drops/SneakerPlaceholderArt';
import { relativeTime } from '@/lib/catalog';
import { excerpt, type NewsListItem } from '@/lib/news';
import { BreakingPill } from './BreakingPill';

/** The denser grid below the feature story: uniform, one of several rather than the one thing on the page. */
export function NewsCard({ item, index = 0 }: { item: NewsListItem; index?: number }) {
  return (
    <Reveal as="li" delay={Math.min(index, 5) * 0.05} className="h-full">
      <Link
        href={`/news/${item.id}`}
        className="edge-glow panel group flex h-full flex-col overflow-hidden transition-colors hover:bg-vault-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <div className="relative">
          {item.dropSneaker ? (
            <SneakerPlaceholderArt
              brand={item.dropSneaker.brand}
              model={item.dropSneaker.model}
              colorway=""
              aspect="wide"
              className="border-0 border-b border-text/[0.08]"
            />
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center border-b border-text/[0.08] bg-vault-deep/70">
              <span className="font-display text-3xl font-bold tracking-tight text-text/20">CHOSN</span>
            </div>
          )}
          {item.isBreaking && <BreakingPill className="absolute left-3 top-3 bg-vault-deep/90" />}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">
            {item.dropSneaker ? item.dropSneaker.brand : 'CHOSN'}
          </p>
          <h3 className="font-display text-xl font-bold leading-snug text-text transition-colors group-hover:text-brass-bright">
            {item.title}
          </h3>
          <p className="text-meta leading-relaxed text-text-soft">{excerpt(item.body, 110)}</p>
          <p className="mt-auto flex items-center justify-between gap-3 pt-3 font-mono text-meta text-text-faint">
            <span className="min-w-0 truncate">
              {item.source} · <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-brass transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </p>
        </div>
      </Link>
    </Reveal>
  );
}
