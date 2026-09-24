import Link from 'next/link';
import { buttonVariantClass } from '@chosn/ui';
import { SneakerArt } from '@/components/ui/SneakerArt';

export interface EmptyStateProps {
  query?: string;
}

/** Direction, not vagueness — says what to do next. */
export function EmptyState({ query }: EmptyStateProps) {
  return (
    <div className="panel ticks relative flex flex-col items-center gap-3 overflow-hidden px-6 py-16 text-center">
      <div aria-hidden className="grid-lines !opacity-30" />
      <SneakerArt colorway="Grey Fog" className="relative h-32 w-56 opacity-40 grayscale" />
      <p className="eyebrow relative">0 results</p>
      <h2 className="relative font-display text-3xl font-bold tracking-tight text-text">
        {query ? <>Nothing matches &ldquo;{query}&rdquo;</> : 'Nothing matches these filters'}
      </h2>
      <p className="relative max-w-md text-text-soft">Try a different search, or browse everything we track.</p>
      <Link href="/sneakers" className={buttonVariantClass('primary', 'relative mt-3 min-h-[44px]')}>
        Browse all sneakers
      </Link>
    </div>
  );
}
