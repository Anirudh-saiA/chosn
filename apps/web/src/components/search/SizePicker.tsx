'use client';

import { useEffect } from 'react';
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
  const current = get('size');

  useEffect(() => {
    if (current) return;
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
      <div role="group" aria-label="Choose your UK size" className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => pick(null)}
          aria-pressed={!current}
          className={`h-9 shrink-0 rounded-full border px-4 font-mono text-[0.78rem] font-bold ${!current ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-text/20 bg-white text-text hover:border-[#14213D]'}`}
        >
          Any
        </button>
        {SIZES.map((s) => {
          const on = Number(current) === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => pick(fmt(s))}
              aria-pressed={on}
              className={`h-9 min-w-[2.6rem] shrink-0 rounded-full border px-3 font-mono text-[0.78rem] font-bold ${on ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-text/20 bg-white text-text hover:border-[#14213D]'}`}
            >
              {fmt(s)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
