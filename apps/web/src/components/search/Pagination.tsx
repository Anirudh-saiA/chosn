import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/** Numbered pages for the results: Previous, 1 2 3 … last, Next. Every link keeps the current filters and only changes `page`. */
export function Pagination({ page, pages, params }: { page: number; pages: number; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') q.set(k, v);
    if (p > 1) q.set('page', String(p));
    const qs = q.toString();
    return qs ? `/sneakers?${qs}` : '/sneakers';
  };
  // 1, the pages around the current one, and the last, with gaps shown as dots.
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => set.add(p));
  const nums = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  nums.forEach((p, i) => {
    if (i > 0 && p - nums[i - 1]! > 1) items.push('gap');
    items.push(p);
  });

  const base = 'flex h-11 min-w-11 items-center justify-center rounded-full border px-3 font-mono text-sm font-bold transition-colors';
  return (
    <nav aria-label="Pages" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" aria-label="Previous page" className={`${base} border-[#0A0A0A]/25 bg-white text-[#0A0A0A] hover:border-[#0A0A0A]`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`g${i}`} aria-hidden className="px-1 text-[#0A0A0A]/50">
            …
          </span>
        ) : (
          <Link
            key={it}
            href={href(it)}
            aria-label={`Page ${it}`}
            aria-current={it === page ? 'page' : undefined}
            className={`${base} ${it === page ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-[#0A0A0A]/25 bg-white text-[#0A0A0A] hover:border-[#0A0A0A]'}`}
          >
            {it}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" aria-label="Next page" className={`${base} border-[#0A0A0A]/25 bg-white text-[#0A0A0A] hover:border-[#0A0A0A]`}>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
