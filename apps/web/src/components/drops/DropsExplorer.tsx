'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DropListItem } from '@/lib/drops';
import { API_URL } from '@/lib/watch';
import { DropCalendar } from './DropCalendar';

const REGION_CHIPS: Array<[string | null, string]> = [
  [null, 'All regions'],
  ['india', 'India'],
  ['us', 'US'],
  ['global', 'Global'],
];

/**
 * The calendar/list toggle. List is the default view (flagged assumption
 * from the original brief): it's scannable immediately, while a calendar
 * needs a moment to orient. Flip the initial `useState` to change it.
 */
export function DropsExplorer({ drops: all }: { drops: DropListItem[] }) {
  // Earlier months are left out entirely: the calendar starts at the current month.
  const drops = useMemo(() => {
    const t = new Date();
    const from = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
    return all.filter((d) => d.releaseDate >= from);
  }, [all]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  const brands = useMemo(() => Array.from(new Set(drops.map((d) => d.sneaker.brand))).sort(), [drops]);

  const filtered = useMemo(
    () => drops.filter((d) => (!brand || d.sneaker.brand === brand) && (!region || d.regions.includes(region))),
    [drops, brand, region],
  );
  const visibleDrops = useMemo(
    () => (selectedDate ? filtered.filter((d) => d.releaseDate === selectedDate) : filtered),
    [filtered, selectedDate],
  );

  const select =
    'min-h-[40px] cursor-pointer appearance-none rounded-full border border-text/10 bg-white px-4 pr-8 font-mono text-[0.72rem] text-text transition-colors [background-image:linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] [background-position:calc(100%-16px)_52%,calc(100%-11px)_52%] [background-size:5px_5px] [background-repeat:no-repeat] hover:border-text/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice';

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter by region" value={region ?? ''} onChange={(e) => setRegion(e.target.value || null)} className={select}>
            {REGION_CHIPS.map(([v, l]) => (
              <option key={String(v)} value={v ?? ''}>{l}</option>
            ))}
          </select>
          {brands.length > 1 && (
            <select aria-label="Filter by brand" value={brand ?? ''} onChange={(e) => setBrand(e.target.value || null)} className={select}>
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <DropCalendar drops={filtered} selectedDate={selectedDate} onSelectDay={setSelectedDate} />

      <p className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[0.72rem] text-text-faint">
        <span aria-live="polite">{visibleDrops.length} of {drops.length} drops</span>
        <Link href="/drops/mine" className="min-h-[36px] content-center text-text underline-offset-4 hover:underline">My drops</Link>
        <a href={`${API_URL}/drops/calendar.ics`} className="min-h-[36px] content-center text-text underline-offset-4 hover:underline">Add all to my calendar</a>
      </p>
    </div>
  );
}
