'use client';

import { X } from 'lucide-react';
import { formatInr, type SearchFacets } from '@/lib/catalog';
import { COLOR_SWATCH, SORT_OPTIONS, splitList } from '@/lib/search-filters';
import { FilterBar } from './FilterBar';
import { SizePicker } from './SizePicker';
import { FilterDrawer, useFilterParams } from './FilterPanel';

/** Result count, sort menu, the mobile Filters button and a removable chip for every active filter. */
export function ResultsToolbar({ total, facets }: { total: number; facets: SearchFacets }) {
  const { get, set, clearAll, activeCount } = useFilterParams();

  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  const remove = (param: string, item: string) => () => set({ [param]: splitList(get(param)).filter((v) => v !== item).join(',') || null });
  const q = get('q');
  if (q) chips.push({ key: 'q', label: `“${q}”`, remove: () => set({ q: null }) });
  for (const b of splitList(get('brand'))) chips.push({ key: `b-${b}`, label: b, remove: remove('brand', b) });
  for (const s of splitList(get('store'))) chips.push({ key: `s-${s}`, label: facets.stores.find((x) => x.slug === s)?.name ?? s, remove: remove('store', s) });
  for (const c of splitList(get('color'))) chips.push({ key: `c-${c}`, label: COLOR_SWATCH[c]?.label ?? c, remove: remove('color', c) });
  const lo = get('minPrice');
  const hi = get('maxPrice');
  if (lo || hi) {
    chips.push({
      key: 'price',
      label: lo && hi ? `${formatInr(Number(lo))} – ${formatInr(Number(hi))}` : lo ? `${formatInr(Number(lo))}+` : `Under ${formatInr(Number(hi))}`,
      remove: () => set({ minPrice: null, maxPrice: null }),
    });
  }
  if (get('minStores')) chips.push({ key: 'ms', label: `${get('minStores')}+ stores`, remove: () => set({ minStores: null }) });
  if (get('soldOut')) chips.push({ key: 'so', label: 'Incl. sold out', remove: () => set({ soldOut: null }) });
  if (get('outlook')) chips.push({ key: 'ol', label: get('outlook') === 'wait' ? 'Worth waiting' : 'Buy now', remove: () => set({ outlook: null }) });

  return (
    <div className="mb-5 flex flex-col gap-3">
      {/* Desktop: the filters as dropdowns across the top. Phones and tablets get the Filters button below. */}
      <SizePicker />
      <FilterBar facets={facets} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <FilterDrawer facets={facets} total={total} />
          <p className="font-mono text-[0.78rem] text-text-soft" aria-live="polite">
            <strong className="font-extrabold text-text">{total.toLocaleString('en-IN')}</strong> {total === 1 ? 'sneaker' : 'sneakers'}
          </p>
        </div>
        <label className="flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-text-soft">
          Sort
          <select
            value={get('sort') ?? ''}
            onChange={(e) => set({ sort: e.target.value || null })}
            className="h-10 cursor-pointer rounded-full border border-text/20 bg-white px-4 font-mono text-[0.78rem] normal-case tracking-normal text-text outline-none focus:border-text"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={chip.remove}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-text px-3.5 font-mono text-[0.72rem] text-white transition-opacity hover:opacity-80"
              >
                {chip.label} <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {activeCount > 1 && (
            <li>
              <button type="button" onClick={clearAll} className="link-underline px-1 font-mono text-[0.72rem] font-bold uppercase tracking-[0.12em] text-text-soft hover:text-text">
                Clear all
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
