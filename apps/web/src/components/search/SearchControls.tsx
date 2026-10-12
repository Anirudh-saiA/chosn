'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

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
 * Landing style: one underlined search line, black pill chips.
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
    <div className="sticky top-16 z-30 -mx-5 flex flex-col gap-4 bg-white/85 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
      <label className="group relative block">
        <span className="sr-only">Search sneakers</span>
        <Search className="pointer-events-none absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 text-[#0A0A0A]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search brand, model or colourway"
          className="w-full border-b-2 border-[#0A0A0A] bg-transparent py-3 pl-10 pr-10 font-display text-[clamp(1.4rem,2.6vw,2.2rem)] uppercase tracking-[0.04em] text-[#0A0A0A] outline-none placeholder:text-[#0A0A0A]/30 [&::-webkit-search-cancel-button]:hidden"
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
            className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-[#0A0A0A] transition-opacity hover:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A0A0A]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </label>

      <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <FilterChip active={!activeBrand} onClick={() => pushParams({ brand: null })}>
          All
        </FilterChip>
        {brands.map((b) => (
          <FilterChip key={b} active={activeBrand === b} onClick={() => pushParams({ brand: b })}>
            {b}
          </FilterChip>
        ))}

        <span className="mx-1 h-5 w-px shrink-0 bg-[#0A0A0A]/20" aria-hidden="true" />

        <FilterChip signal active={buyOnly} onClick={() => pushParams({ signal: buyOnly ? null : 'good_time_to_buy' })}>
          Good time to buy
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
      className={`inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border-2 px-5 font-display text-[0.95rem] uppercase tracking-[0.14em] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
        active ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-[#0A0A0A]/15 bg-white text-[#0A0A0A] hover:border-[#0A0A0A]'
      }`}
    >
      {signal && <span aria-hidden className={`h-2 w-2 rounded-full ${active ? 'bg-[#FF7A1A]' : 'bg-[#0A0A0A]/30'}`} />}
      {children}
    </button>
  );
}
