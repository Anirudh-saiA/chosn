'use client';

import { useEffect, useRef } from 'react';
import { useFilterParams } from './FilterPanel';

const KEY = 'chosn:size';
// UK sizes in half steps, the range sneakers in this catalogue come in.
const SIZES = Array.from({ length: 25 }, (_, i) => 3 + i * 0.5);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function remembered(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function remember(v: string): void {
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}

/**
 * "My size": pick a UK size once and Compare lists only shoes in stock in it, with that size's own price. The choice is kept on this
 * device and applied the next time Compare opens without a size in its address. "Any" turns it off (and is remembered too).
 */
export function SizePicker() {
  const { get, set } = useFilterParams();
  const raw = get('size');
  // 'any' in the address means "no size filter, and do not apply my remembered size" (the empty-state link uses it).
  const current = raw === 'any' ? null : raw;
  const row = useRef<HTMLDivElement>(null);

  // Phones show only a few chips at a time: scroll the chosen size (or UK 7 when none is chosen) into the middle of the row.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>(current ? '[aria-pressed="true"]:not([data-any])' : '[data-size="7"]');
    const box = row.current;
    if (!el || !box) return;
    const e = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    box.scrollTo({ left: box.scrollLeft + (e.left - b.left) - b.width / 2 + e.width / 2, behavior: 'auto' });
  }, [current]);

  useEffect(() => {
    if (raw === 'any') remember('any');
    if (raw) return;
    const saved = remembered();
    if (saved && saved !== 'any' && SIZES.includes(Number(saved))) set({ size: saved, page: null });
    // only on first load: after that the URL is the source of truth
  }, []);

  const pick = (v: string | null) => {
    remember(v ?? 'any');
    set({ size: v, page: null });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-text">My size (UK)</span>
      <div ref={row} role="group" aria-label="Choose your UK size" className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
        <button
          type="button"
          data-any
          onClick={() => pick(null)}
          aria-pressed={!current}
          className={`h-11 shrink-0 rounded-full border px-4 font-mono text-[0.78rem] font-bold ${!current ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-text/20 bg-white text-text hover:border-[#14213D]'}`}
        >
          Any
        </button>
        {SIZES.map((s) => {
          const on = Number(current) === s;
          return (
            <button
              key={s}
              data-size={fmt(s)}
              type="button"
              onClick={() => pick(fmt(s))}
              aria-pressed={on}
              className={`h-11 min-w-[2.75rem] shrink-0 rounded-full border px-3 font-mono text-[0.78rem] font-bold ${on ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-text/20 bg-white text-text hover:border-[#14213D]'}`}
            >
              {fmt(s)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
