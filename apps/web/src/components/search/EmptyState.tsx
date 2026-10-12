import Link from 'next/link';

export interface EmptyStateProps {
  query?: string;
}

/** Direction, not vagueness — says what to do next. */
export function EmptyState({ query }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-[#0A0A0A]/10 px-6 py-20 text-center">
      <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.3em] text-[#0A0A0A]/55">0 results</p>
      <h2 className="font-display text-[clamp(2rem,5vw,3.6rem)] uppercase leading-[0.95] tracking-[0.01em] text-[#0A0A0A]">
        {query ? <>Nothing matches &ldquo;{query}&rdquo;</> : 'Nothing matches these filters'}
      </h2>
      <p className="max-w-md text-[1.05rem] font-bold text-[#0A0A0A]/60">Try a different search, or browse everything we track.</p>
      <Link
        href="/sneakers"
        className="mt-3 inline-flex items-center rounded-full bg-[#0A0A0A] px-7 py-3.5 font-display text-[1.05rem] uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#262626]"
      >
        Browse all sneakers
      </Link>
    </div>
  );
}
