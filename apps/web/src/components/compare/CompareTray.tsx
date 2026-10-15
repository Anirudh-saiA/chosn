'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';
import { COMPARE_MAX, useCompareList } from './useCompareList';

/** Floating bar listing the shoes picked to compare, with a link to the side-by-side page. */
export function CompareTray() {
  const { items, remove, clear } = useCompareList();
  const pathname = usePathname();
  if (items.length === 0 || pathname.startsWith('/compare')) return null;

  const href = `/compare?styles=${items.map((i) => encodeURIComponent(i.styleCode)).join(',')}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6">
      <div
        role="region"
        aria-label="Sneakers selected to compare"
        className="pointer-events-auto flex w-full max-w-[44rem] items-center gap-3 rounded-2xl bg-[#14213D] p-2.5 pl-3 text-white shadow-[0_18px_50px_-12px_rgba(20,33,61,0.55)]"
      >
        <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {items.map((item) => (
            <li key={item.styleCode} className="relative shrink-0">
              <div className="h-12 w-12 overflow-hidden rounded-lg bg-white">
                {item.imageUrl ? (
                  <img referrerPolicy="no-referrer" src={item.imageUrl} alt={`${item.brand} ${item.model}`} className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="grid h-full w-full place-items-center font-mono text-[0.55rem] text-[#14213D]/60">{item.brand}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(item.styleCode)}
                aria-label={`Remove ${item.brand} ${item.model} from compare`}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[#14213D] shadow"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
          {items.length < COMPARE_MAX && (
            <li aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-white/30 font-mono text-[0.6rem] text-white/50">
              +{COMPARE_MAX - items.length}
            </li>
          )}
        </ul>
        <button type="button" onClick={clear} className="hidden shrink-0 px-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-white/60 hover:text-white sm:block">
          Clear
        </button>
        <Link
          href={items.length < 2 ? '/sneakers' : href}
          className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 font-mono text-[0.74rem] font-bold uppercase tracking-[0.12em] transition-colors ${
            items.length < 2 ? 'bg-white/15 text-white/70' : 'bg-white text-[#14213D] hover:bg-[#F6F2EA]'
          }`}
        >
          {items.length < 2 ? 'Add one more' : `Compare ${items.length}`}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
