'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import type { SearchFacets } from '@/lib/catalog';
import { formatInr } from '@/lib/catalog';
import { COLOR_SWATCH, FILTER_KEYS, PRICE_PRESETS, splitList, toggleInList } from '@/lib/search-filters';

/** Reads and writes the filter query params; every change is a real navigation, the server does the filtering. */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function clearAll() {
    set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
  }

  const activeCount =
    splitList(searchParams.get('brand')).length +
    splitList(searchParams.get('store')).length +
    splitList(searchParams.get('color')).length +
    (searchParams.get('minPrice') || searchParams.get('maxPrice') ? 1 : 0) +
    (searchParams.get('minStores') ? 1 : 0) +
    (searchParams.get('soldOut') ? 1 : 0) +
    (searchParams.get('signal') ? 1 : 0);

  return { get: (k: string) => searchParams.get(k), set, clearAll, activeCount, pending };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-text/10 py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-text">{title}</h3>
        {hint && <span className="font-mono text-[0.62rem] text-text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function CheckRow({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className="flex min-h-[34px] cursor-pointer items-center gap-3 text-[0.92rem] text-text hover:text-text">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 cursor-pointer rounded accent-[#14213D]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="font-mono text-[0.72rem] tabular-nums text-text-faint">{count}</span>}
    </label>
  );
}

function PriceFilter({ facets, get, set }: { facets: SearchFacets; get: (k: string) => string | null; set: (n: Record<string, string | null>) => void }) {
  const urlMin = get('minPrice') ?? '';
  const urlMax = get('maxPrice') ?? '';
  const [min, setMin] = useState(urlMin);
  const [max, setMax] = useState(urlMax);
  // Keep the boxes in step when the URL changes elsewhere (a chip removed, "Clear all").
  useEffect(() => {
    setMin(urlMin);
    setMax(urlMax);
  }, [urlMin, urlMax]);

  const clean = (v: string) => v.replace(/[^\d]/g, '').slice(0, 7);
  const apply = (nextMin = min, nextMax = max) => set({ minPrice: nextMin || null, maxPrice: nextMax || null });
  const field =
    'h-10 w-full rounded-lg border border-text/20 bg-white px-3 font-mono text-[0.88rem] tabular-nums text-text outline-none transition-colors placeholder:text-text-faint focus:border-text';

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Minimum price in rupees</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint">₹</span>
          <input inputMode="numeric" placeholder="Min" value={min} onChange={(e) => setMin(clean(e.target.value))} onBlur={(e) => apply(clean(e.target.value), max)} onKeyDown={(e) => e.key === 'Enter' && apply(clean(e.currentTarget.value), max)} className={`${field} pl-7`} />
        </label>
        <span aria-hidden className="text-text-faint">–</span>
        <label className="relative block flex-1">
          <span className="sr-only">Maximum price in rupees</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint">₹</span>
          <input inputMode="numeric" placeholder="Max" value={max} onChange={(e) => setMax(clean(e.target.value))} onBlur={(e) => apply(min, clean(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && apply(min, clean(e.currentTarget.value))} className={`${field} pl-7`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRICE_PRESETS.map((p) => {
          const active = (get('minPrice') ?? '') === p.min && (get('maxPrice') ?? '') === p.max;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setMin(p.min);
                setMax(p.max);
                apply(active ? '' : p.min, active ? '' : p.max);
              }}
              className={`rounded-full border px-3 py-1.5 font-mono text-[0.7rem] transition-colors ${active ? 'border-text bg-text text-white' : 'border-text/20 text-text-soft hover:border-text hover:text-text'}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {facets.price.max > 0 && (
        <p className="mt-3 font-mono text-[0.66rem] text-text-faint">
          Prices here run {formatInr(facets.price.min)} – {formatInr(facets.price.max)}
        </p>
      )}
    </div>
  );
}

/** The whole filter column. Brand = "company"; every other filter narrows the same live catalog. */
export function FilterPanel({ facets, total }: { facets: SearchFacets; total: number }) {
  const { get, set, clearAll, activeCount, pending } = useFilterParams();
  const [brandQuery, setBrandQuery] = useState('');
  const brands = splitList(get('brand'));
  const stores = splitList(get('store'));
  const colors = splitList(get('color'));
  // A to Z, whatever order the API sent them in; the box under the heading narrows a long list.
  const sortedBrands = [...facets.brands].sort((a, b) => a.value.localeCompare(b.value, 'en', { sensitivity: 'base' }));
  const shownBrands = brandQuery.trim() ? sortedBrands.filter((b) => b.value.toLowerCase().includes(brandQuery.trim().toLowerCase())) : sortedBrands;
  const sortedStores = [...facets.stores].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const minStores = get('minStores') ?? '';

  return (
    <div className={`transition-opacity ${pending ? 'opacity-60' : ''}`} aria-busy={pending}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-[1.35rem] font-bold uppercase tracking-tight text-text">
          <SlidersHorizontal className="h-5 w-5" aria-hidden /> Filters
        </h2>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="link-underline font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-text-soft hover:text-text">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <Section title="Company" hint={`${facets.brands.length} brands · A to Z`}>
        {facets.brands.length > 8 && (
          <input
            type="search"
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            placeholder="Find a company"
            aria-label="Find a company"
            className="mb-2 h-9 w-full rounded-full border border-text/15 bg-white px-4 text-[0.85rem] text-text outline-none placeholder:text-text-faint focus:border-text"
          />
        )}
        <div className="max-h-64 overflow-y-auto pr-1">
          {shownBrands.map((b) => (
            <CheckRow key={b.value} label={b.value} count={b.count} checked={brands.includes(b.value)} onChange={() => set({ brand: toggleInList(get('brand'), b.value) || null })} />
          ))}
          {shownBrands.length === 0 && <p className="py-2 text-[0.85rem] text-text-soft">No company matches.</p>}
        </div>
      </Section>

      <Section title="Store" hint="where it's in stock · A to Z">
        {sortedStores.map((s) => (
          <CheckRow key={s.slug} label={s.name} count={s.count} checked={stores.includes(s.slug)} onChange={() => set({ store: toggleInList(get('store'), s.slug) || null })} />
        ))}
      </Section>

      <Section title="Price">
        <PriceFilter facets={facets} get={get} set={set} />
      </Section>

      <Section title="Colour">
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
                  className={`relative grid h-9 w-9 place-items-center rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${on ? 'border-text' : 'border-text/15'}`}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {on && <Check className="h-4 w-4" style={{ color: ['white', 'beige', 'yellow', 'pink'].includes(c.value) ? '#111' : '#fff' }} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        {colors.length > 0 && <p className="mt-3 font-mono text-[0.66rem] text-text-faint">Shoes that include {colors.map((c) => COLOR_SWATCH[c]?.label ?? c).join(' or ')}</p>}
      </Section>

      <Section title="Compare across sites" hint="more stores, more to compare">
        {[
          { v: '', label: 'Any number of stores' },
          { v: '2', label: 'At 2 or more stores' },
          { v: '3', label: 'At 3 or more stores' },
          { v: '4', label: 'At 4 or more stores' },
        ].map((o) => (
          <label key={o.v} className="flex min-h-[34px] cursor-pointer items-center gap-3 text-[0.92rem] text-text">
            <input type="radio" name="min-stores" checked={minStores === o.v} onChange={() => set({ minStores: o.v || null })} className="h-4 w-4 cursor-pointer accent-[#14213D]" />
            {o.label}
          </label>
        ))}
      </Section>

      <Section title="Availability">
        <CheckRow label="Include sold out" checked={get('soldOut') === '1'} onChange={() => set({ soldOut: get('soldOut') === '1' ? null : '1' })} />
        <CheckRow label="Good time to buy" checked={get('signal') === 'good_time_to_buy'} onChange={() => set({ signal: get('signal') === 'good_time_to_buy' ? null : 'good_time_to_buy' })} />
      </Section>

      <p className="mt-2 font-mono text-[0.68rem] text-text-faint" aria-live="polite">
        {total.toLocaleString('en-IN')} {total === 1 ? 'sneaker matches' : 'sneakers match'}
      </p>
    </div>
  );
}

/** Phone / tablet: a button that opens the same filters as a bottom sheet. */
export function FilterDrawer({ facets, total }: { facets: SearchFacets; total: number }) {
  const [open, setOpen] = useState(false);
  const { activeCount } = useFilterParams();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-text bg-white px-5 font-mono text-[0.76rem] font-bold uppercase tracking-[0.14em] text-text"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
        {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-text px-1 text-[0.65rem] text-white">{activeCount}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-[#0A0A0A]/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-end px-4 pt-3">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-text/15">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-4">
              <FilterPanel facets={facets} total={total} />
            </div>
            <div className="border-t border-text/10 p-4">
              <button type="button" onClick={() => setOpen(false)} className="min-h-[48px] w-full rounded-full bg-[#14213D] font-mono text-[0.78rem] font-bold uppercase tracking-[0.14em] text-white">
                Show {total.toLocaleString('en-IN')} sneakers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
