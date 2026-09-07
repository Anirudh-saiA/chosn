'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cx } from '@chosn/ui';

export interface SearchControlsProps {
  brands: string[];
}

const DEBOUNCE_MS = 300;

/**
 * All filtering is query params driving a real Next.js navigation
 * (task 3: server-side, not a client-side filter of a full dataset) —
 * this component only ever reads/writes the URL, page.tsx does the
 * actual fetch. Text input is debounced; brand/signal are discrete
 * toggles and apply immediately on click.
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
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="sr-only">Search sneakers</span>
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search by brand, model, or colorway…"
          className="w-full border border-moss/40 bg-vault-raised px-4 py-3 font-sans text-body text-text placeholder:text-text-faint focus:border-moss"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={!activeBrand} onClick={() => pushParams({ brand: null })}>
          All brands
        </FilterChip>
        {brands.map((b) => (
          <FilterChip key={b} active={activeBrand === b} onClick={() => pushParams({ brand: b })}>
            {b}
          </FilterChip>
        ))}

        <span className="mx-1 h-5 w-px bg-moss/25" aria-hidden="true" />

        <FilterChip
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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'rounded-chip border px-3 py-1.5 font-mono text-data-delta transition-colors duration-150 ease-chosn',
        active
          ? 'border-brass bg-brass text-vault'
          : 'border-moss/40 bg-transparent text-text-soft hover:border-moss hover:text-text',
      )}
    >
      {children}
    </button>
  );
}
