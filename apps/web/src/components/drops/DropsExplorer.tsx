'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DropListItem } from '@/lib/drops';
import { API_URL } from '@/lib/watch';
import { SelectMenu } from '@/components/ui/SelectMenu';
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

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          <SelectMenu
            label="Filter by region"
            align="left"
            value={region ?? ''}
            options={REGION_CHIPS.map(([v, l]) => ({ value: v ?? '', label: l }))}
            onChange={(v) => setRegion(v || null)}
          />
          {brands.length > 1 && (
            <SelectMenu
              label="Filter by brand"
              value={brand ?? ''}
              options={[{ value: '', label: 'All brands' }, ...brands.map((b) => ({ value: b, label: b }))]}
              onChange={(v) => setBrand(v || null)}
            />
          )}
        </div>
      </div>

      <DropCalendar drops={filtered} selectedDate={selectedDate} onSelectDay={setSelectedDate} />

      <p className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[0.72rem] text-text-faint">
        <span aria-live="polite">{visibleDrops.length} of {drops.length} drops</span>
        <Link href="/drops/mine" className="min-h-[44px] content-center text-text underline-offset-4 hover:underline">My drops</Link>
        <a href={`${API_URL}/drops/calendar.ics`} className="min-h-[44px] content-center text-text underline-offset-4 hover:underline">Add all to my calendar</a>
      </p>
    </div>
  );
}
