'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { relativeTime } from '@/lib/catalog';
import { excerpt, type NewsListItem } from '@/lib/news';

const PAGE = 18;

/**
 * Sneaker and fashion headlines gathered from other sites' public feeds. Only the headline, a short excerpt and the date are shown; every
 * row links out to the original, so readers (and the credit) go to the publisher.
 */
export function ExternalNews({ items }: { items: NewsListItem[] }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <>
      <ul className="divide-y divide-text/10 overflow-hidden rounded-2xl border border-text/12 bg-white">
        {items.slice(0, shown).map((it) => (
          <li key={it.id}>
            <a href={it.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer nofollow" className="group flex items-start justify-between gap-4 px-5 py-4 hover:bg-[#FFFFFF]">
              <span className="min-w-0">
                <span className="block font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brass">
                  {it.source} · <time dateTime={it.publishedAt}>{relativeTime(it.publishedAt)}</time>
                </span>
                <span className="mt-1 block font-display text-lg font-bold leading-snug text-text group-hover:underline">{it.title}</span>
                {it.body && it.body !== it.title ? <span className="mt-1 line-clamp-2 block text-sm text-text-soft">{excerpt(it.body, 160)}</span> : null}
              </span>
              <span className="mt-1 flex shrink-0 items-center gap-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-text-soft">
                Read at {it.source} <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
      {shown < items.length ? (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-full border border-[#0A0A0A] bg-white px-7 py-3 font-display text-lg uppercase tracking-[0.06em] text-[#0A0A0A] hover:bg-[#FFFFFF]">
            Show more ({items.length - shown} left)
          </button>
        </div>
      ) : null}
    </>
  );
}
