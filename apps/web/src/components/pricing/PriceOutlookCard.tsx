'use client';

import { useState } from 'react';
import type { PriceOutlook } from '@/lib/catalog';

const LOOK = {
  buy_now: { label: 'Buy now', pill: 'bg-[#1F8A4C] text-white', ring: 'border-[#1F8A4C]/40' },
  wait: { label: 'Wait', pill: 'bg-[#D97706] text-white', ring: 'border-[#D97706]/40' },
  fair: { label: 'Fair price', pill: 'bg-[#14213D] text-white', ring: 'border-text/15' },
  unclear: { label: 'Too early to say', pill: 'bg-text/10 text-text', ring: 'border-text/15' },
} as const;
const CONF = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' } as const;

/** The Buy now / Wait call for this shoe in this size, with every reason behind it one tap away. */
export function PriceOutlookCard({ outlook }: { outlook: PriceOutlook | null }) {
  const [open, setOpen] = useState(false);
  if (!outlook) return null;
  const look = LOOK[outlook.verdict];
  const shown = outlook.factors.filter((f) => f.points !== 0);
  return (
    <section aria-label="Buy now or wait" className={`rounded-2xl border bg-white p-4 sm:p-5 ${look.ring}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-4 py-1.5 font-display text-lg uppercase tracking-[0.04em] ${look.pill}`}>{look.label}</span>
        <p className="min-w-0 flex-1 text-[0.95rem] font-semibold text-text">{outlook.headline}</p>
      </div>
      <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-text-soft">
        {CONF[outlook.confidence]}
        {outlook.historyDays > 0 ? ` · ${outlook.historyDays} day${outlook.historyDays === 1 ? '' : 's'} of this shoe's prices` : ''}
      </p>

      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 inline-flex min-h-[44px] min-w-[44px] items-center text-sm font-semibold text-text underline underline-offset-4">
        {open ? 'Hide why' : 'Why?'}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <ul className="space-y-2">
            {(shown.length ? shown : outlook.factors).map((f) => (
              <li key={f.label} className="flex gap-3 text-sm">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white ${f.effect === 'buy' ? 'bg-[#1F8A4C]' : f.effect === 'wait' ? 'bg-[#D97706]' : 'bg-text/30'}`}
                >
                  {f.effect === 'buy' ? '+' : f.effect === 'wait' ? '−' : 'i'}
                </span>
                <span>
                  <strong className="text-text">{f.label}.</strong> <span className="text-text-soft">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-text-soft">
            This is an estimate from today&apos;s prices at each store, this shoe&apos;s own price history, how similar shoes have moved, stock levels and the sale calendar. It is not a
            promise: prices can fall or rise without warning. We only track about six weeks of prices so far, so it gets sharper as history builds.
          </p>
        </div>
      ) : null}
    </section>
  );
}
