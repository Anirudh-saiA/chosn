'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { SearchFacets } from '@/lib/catalog';
import { COLOR_SWATCH, splitList, toggleInList } from '@/lib/search-filters';
import { CheckRow, PriceFilter, useFilterParams } from './FilterPanel';

/** One filter button with a dropdown panel. Closes on a click outside or Escape. */
function Dropdown({ label, count = 0, children, width = 'w-72' }: { label: string; count?: number; children: ReactNode; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[0.86rem] font-semibold transition-colors ${
          count > 0 || open ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-[#0A0A0A]/20 bg-white text-[#0A0A0A] hover:border-[#0A0A0A]'
        }`}
      >
        {label}
        {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[0.68rem] font-bold text-[#0A0A0A]">{count}</span>}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div className={`absolute left-0 top-12 z-40 ${width} max-w-[90vw] rounded-2xl border border-[#0A0A0A]/10 bg-white p-4 shadow-[0_12px_40px_rgba(10,10,10,0.16)]`}>{children}</div>}
    </div>
  );
}

/**
 * The filters as a row of dropdowns across the top of the results (like Myntra), so the shoes can use the full width. Same filters,
 * same URL parameters as the old side column: every change is a real navigation and the server does the filtering.
 */
export function FilterBar({ facets }: { facets: SearchFacets }) {
  const { get, set, clearAll, activeCount, pending } = useFilterParams();
  const [brandQuery, setBrandQuery] = useState('');
  const brands = splitList(get('brand'));
  const stores = splitList(get('store'));
  const colors = splitList(get('color'));
  const sortedBrands = [...facets.brands].sort((a, b) => a.value.localeCompare(b.value, 'en', { sensitivity: 'base' }));
  const shownBrands = brandQuery.trim() ? sortedBrands.filter((b) => b.value.toLowerCase().includes(brandQuery.trim().toLowerCase())) : sortedBrands;
  const sortedStores = [...facets.stores].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const minStores = get('minStores') ?? '';
  const priceOn = get('minPrice') || get('maxPrice') ? 1 : 0;
  const moreOn = (get('soldOut') ? 1 : 0) + (get('signal') ? 1 : 0);

  return (
    <div className={`hidden flex-wrap items-center gap-2 lg:flex ${pending ? 'opacity-60' : ''}`} aria-busy={pending} role="group" aria-label="Filters">
      <Dropdown label="Company" count={brands.length} width="w-80">
        {facets.brands.length > 8 && (
          <input
            type="search"
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            placeholder="Find a company"
            aria-label="Find a company"
            className="mb-2 h-9 w-full rounded-full border border-[#0A0A0A]/15 bg-white px-4 text-[0.85rem] outline-none placeholder:text-[#0A0A0A]/40 focus:border-[#0A0A0A]"
          />
        )}
        <div className="max-h-72 overflow-y-auto pr-1">
          {shownBrands.map((b) => (
            <CheckRow key={b.value} label={b.value} count={b.count} checked={brands.includes(b.value)} onChange={() => set({ brand: toggleInList(get('brand'), b.value) || null })} />
          ))}
          {shownBrands.length === 0 && <p className="py-2 text-[0.85rem] text-[#0A0A0A]/55">No company matches.</p>}
        </div>
      </Dropdown>

      <Dropdown label="Store" count={stores.length}>
        <p className="mb-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#0A0A0A]/45">Where it&apos;s in stock</p>
        {sortedStores.map((s) => (
          <CheckRow key={s.slug} label={s.name} count={s.count} checked={stores.includes(s.slug)} onChange={() => set({ store: toggleInList(get('store'), s.slug) || null })} />
        ))}
      </Dropdown>

      <Dropdown label="Price" count={priceOn} width="w-80">
        <PriceFilter facets={facets} get={get} set={set} />
      </Dropdown>

      <Dropdown label="Colour" count={colors.length} width="w-80">
        <ul className="grid grid-cols-6 gap-2.5">
          {facets.colors.map((c) => {
            const swatch = COLOR_SWATCH[c.value];
            if (!swatch) return null;
            const on = colors.includes(c.value);
            return (
              <li key={c.value}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${swatch.label} (${c.count})`}
                  title={`${swatch.label} · ${c.count}`}
                  onClick={() => set({ color: toggleInList(get('color'), c.value) || null })}
                  className={`relative grid h-9 w-9 place-items-center rounded-full border-2 transition-transform hover:scale-110 ${on ? 'border-[#0A0A0A]' : 'border-[#0A0A0A]/15'}`}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {on && <Check className="h-4 w-4" style={{ color: ['white', 'beige', 'yellow', 'pink'].includes(c.value) ? '#111' : '#fff' }} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        {colors.length > 0 && <p className="mt-3 font-mono text-[0.66rem] text-[#0A0A0A]/45">Shoes that include {colors.map((c) => COLOR_SWATCH[c]?.label ?? c).join(' or ')}</p>}
      </Dropdown>

      <Dropdown label="Compare" count={minStores ? 1 : 0}>
        <p className="mb-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#0A0A0A]/45">More stores, more to compare</p>
        {[
          { v: '', label: 'Any number of stores' },
          { v: '2', label: 'At 2 or more stores' },
          { v: '3', label: 'At 3 or more stores' },
          { v: '4', label: 'At 4 or more stores' },
        ].map((o) => (
          <label key={o.v} className="flex min-h-[34px] cursor-pointer items-center gap-3 text-[0.92rem]">
            <input type="radio" name="min-stores-bar" checked={minStores === o.v} onChange={() => set({ minStores: o.v || null })} className="h-4 w-4 cursor-pointer accent-[#14213D]" />
            {o.label}
          </label>
        ))}
      </Dropdown>

      <Dropdown label="More" count={moreOn}>
        <CheckRow label="Include sold out" checked={get('soldOut') === '1'} onChange={() => set({ soldOut: get('soldOut') === '1' ? null : '1' })} />
        <CheckRow label="Good time to buy" checked={get('signal') === 'good_time_to_buy'} onChange={() => set({ signal: get('signal') === 'good_time_to_buy' ? null : 'good_time_to_buy' })} />
      </Dropdown>

      {activeCount > 0 && (
        <button type="button" onClick={clearAll} className="ml-1 px-2 text-[0.78rem] font-bold uppercase tracking-[0.1em] text-[#0A0A0A]/55 hover:text-[#0A0A0A]">
          Clear all
        </button>
      )}
    </div>
  );
}
