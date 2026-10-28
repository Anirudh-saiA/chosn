import Link from 'next/link';

export interface EmptyStateProps {
  query?: string;
  /** The UK size filter in use, if any: the empty state then offers the sizes next to it. */
  size?: string;
  /** The other filters, so the links below keep them. */
  params?: Record<string, string | undefined>;
}

const link = (params: Record<string, string | undefined>, size: string | null) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== 'size' && k !== 'page') q.set(k, v);
  q.set('size', size ?? 'any');
  const qs = q.toString();
  return qs ? `/sneakers?${qs}` : '/sneakers';
};
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Direction, not vagueness — says what to do next. */
export function EmptyState({ query, size, params = {} }: EmptyStateProps) {
  const n = Number(size);
  const nearby = size && Number.isFinite(n) ? [n - 1, n - 0.5, n + 0.5, n + 1].filter((x) => x >= 3 && x <= 15) : [];
  return (
    <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-[#0A0A0A]/10 px-6 py-20 text-center">
      <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.3em] text-[#0A0A0A]/55">0 results</p>
      <h2 className="font-display text-[clamp(2rem,5vw,3.6rem)] uppercase leading-[0.95] tracking-[0.01em] text-[#0A0A0A]">
        {query ? <>Nothing matches &ldquo;{query}&rdquo;</> : size ? <>Nothing in UK {size} matches</> : 'Nothing matches these filters'}
      </h2>
      <p className="max-w-md text-[1.05rem] font-bold text-[#0A0A0A]/60">{size ? 'No store has what you picked in this size right now. Try a size next to it, or any size.' : 'Try a different search, or browse everything we track.'}</p>
      {size ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {nearby.map((x) => (
            <Link key={x} href={link(params, fmt(x))} className="rounded-full border border-[#0A0A0A]/25 bg-white px-5 py-2 font-mono text-sm font-bold text-[#0A0A0A] hover:border-[#0A0A0A]">
              UK {fmt(x)}
            </Link>
          ))}
          <Link href={link(params, null)} className="rounded-full bg-[#0A0A0A] px-5 py-2 font-mono text-sm font-bold text-white">
            Any size
          </Link>
        </div>
      ) : null}
      <Link
        href="/sneakers"
        className="mt-3 inline-flex items-center rounded-full bg-[#0A0A0A] px-7 py-3.5 font-display text-[1.05rem] uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#262626]"
      >
        Browse all sneakers
      </Link>
    </div>
  );
}
