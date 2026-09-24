'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cx } from '@chosn/ui';

export interface SearchControlsProps {
  brands: string[];
}

const DEBOUNCE_MS = 300;

/**
 * All filtering is query params driving a real Next.js navigation
 * (server-side, not a client-side filter of a full dataset) — this
 * component only ever reads/writes the URL, page.tsx does the actual
 * fetch. Text input is debounced; brand/signal are discrete toggles and
 * apply immediately on click. Sticks under the masthead while scrolling.
 */
export function SearchControls({ brands }: SearchControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeBrand = searchParams.get('brand');
  const buyOnly = searchParams.get('signal') === 'good_time_to_buy';

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value || null }), DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="sticky top-16 z-30 -mx-5 flex flex-col gap-3 border-y border-text/[0.08] bg-vault-deep/85 px-5 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
      <label className="group relative block">
        <span className="sr-only">Search sneakers</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-faint transition-colors group-focus-within:text-brass-bright"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search brand, model or colorway…"
          className="min-h-[52px] w-full border border-text/15 bg-vault-deep/80 py-3 pl-12 pr-12 font-sans text-base text-text sm:text-lg outline-none transition-all duration-200 placeholder:text-text-faint hover:border-text/30 focus-visible:border-ice focus-visible:shadow-[0_0_0_3px_rgba(143,214,255,.18)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              if (debounceRef.current) clearTimeout(debounceRef.current);
              pushParams({ q: null });
            }}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-text-faint transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass-bright"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </label>

      <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <FilterChip active={!activeBrand} onClick={() => pushParams({ brand: null })}>
          All brands
        </FilterChip>
        {brands.map((b) => (
          <FilterChip key={b} active={activeBrand === b} onClick={() => pushParams({ brand: b })}>
            {b}
          </FilterChip>
        ))}

        <span className="mx-1 h-5 w-px shrink-0 bg-text/15" aria-hidden="true" />

        <FilterChip
          signal
          active={buyOnly}
          onClick={() => pushParams({ signal: buyOnly ? null : 'good_time_to_buy' })}
        >
          Good time to buy only
        </FilterChip>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  signal = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  signal?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[44px] shrink-0 items-center gap-2 border px-3.5 font-mono text-data-delta transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright sm:min-h-[38px]',
        active
          ? signal
            ? 'border-signal/60 bg-signal/15 text-signal'
            : 'border-brass-bright/50 bg-brass-gradient font-semibold text-vault-deep'
          : 'border-text/15 bg-vault-raised/60 text-text-soft hover:border-brass/50 hover:text-text',
      )}
    >
      {signal && <span aria-hidden className={cx('h-1.5 w-1.5 rounded-full', active ? 'bg-signal' : 'bg-text-faint')} />}
      {children}
    </button>
  );
}
