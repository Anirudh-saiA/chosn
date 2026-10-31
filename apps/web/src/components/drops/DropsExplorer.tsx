'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cx } from '@chosn/ui';
import type { DropListItem } from '@/lib/drops';
import { countryOf, isIndiaDrop } from '@/lib/drop-region';
import { API_URL } from '@/lib/watch';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { ReleaseCalendar, type CalendarView } from './ReleaseCalendar';

type Scope = 'india' | 'elsewhere';

const VIEWS: Array<[CalendarView, string]> = [
  ['month', 'Month'],
  ['week', 'Week'],
  ['list', 'List'],
];

const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2';

/**
 * The Drops calendar. India comes first and holds only shoes that release in India (or that Indian stores already carry). The second tab,
 * "Released elsewhere", holds everything else, each marked with its country and an official-site button only where we hold a real link.
 */
export function DropsExplorer({ drops }: { drops: DropListItem[] }) {
  const [scope, setScope] = useState<Scope>('india');
  const [view, setView] = useState<CalendarView>('month');
  const [brand, setBrand] = useState('');
  const [country, setCountry] = useState('');

  const { india, elsewhere } = useMemo(() => {
    const i: DropListItem[] = [];
    const e: DropListItem[] = [];
    for (const d of drops) (isIndiaDrop(d) ? i : e).push(d);
    return { india: i, elsewhere: e };
  }, [drops]);

  const pool = scope === 'india' ? india : elsewhere;
  const brands = useMemo(() => Array.from(new Set(pool.map((d) => d.sneaker.brand))).sort(), [pool]);
  const countries = useMemo(() => Array.from(new Set(elsewhere.map((d) => countryOf(d).name))).sort(), [elsewhere]);

  const shown = useMemo(
    () => pool.filter((d) => (!brand || d.sneaker.brand === brand) && (scope === 'india' || !country || countryOf(d).name === country)),
    [pool, brand, country, scope],
  );

  function pick(s: Scope) {
    setScope(s);
    setBrand('');
    setCountry('');
  }

  const tab = (s: Scope, label: string, n: number) => (
    <button
      key={s}
      type="button"
      role="tab"
      id={`rel-tab-${s}`}
      aria-selected={scope === s}
      aria-controls="rel-panel"
      onClick={() => pick(s)}
      className={cx('flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full px-4 text-[0.9rem] font-semibold transition-colors sm:flex-none sm:px-6', ring, scope === s ? 'bg-[#0A0A0A] text-white' : 'text-[#0A0A0A] hover:bg-[#0A0A0A]/[0.06]')}
    >
      {label}
      <span className={cx('rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-bold', scope === s ? 'bg-white text-[#0A0A0A]' : 'bg-[#0A0A0A]/10 text-[#0A0A0A]')}>{n}</span>
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div role="tablist" aria-label="Where the shoe releases" className="flex w-full gap-1 rounded-full border border-[#0A0A0A]/15 bg-white p-1 sm:w-fit">
        {tab('india', 'India', india.length)}
        {tab('elsewhere', 'Released elsewhere', elsewhere.length)}
      </div>

      <p className="text-[0.9rem] leading-relaxed text-[#404040]">
        {scope === 'india'
          ? 'Shoes releasing in India, or already in Indian stores. Prices are in rupees.'
          : 'Not confirmed for India. Each shoe shows its country. A "Buy at official site" button appears only where we hold the brand\'s own or an official retailer\'s link; prices are converted to rupees and are approximate.'}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Calendar view" className="flex gap-1 rounded-full border border-[#0A0A0A]/15 bg-white p-1">
          {VIEWS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cx('min-h-[44px] rounded-full px-4 text-[0.85rem] font-semibold transition-colors', ring, view === v ? 'bg-[#0A0A0A] text-white' : 'text-[#0A0A0A] hover:bg-[#0A0A0A]/[0.06]')}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {scope === 'elsewhere' && countries.length > 1 && (
            <SelectMenu
              label="Filter by country"
              align="left-on-phone"
              value={country}
              options={[{ value: '', label: 'All countries' }, ...countries.map((c) => ({ value: c, label: c }))]}
              onChange={setCountry}
            />
          )}
          {brands.length > 1 && (
            <SelectMenu
              label="Filter by brand"
              value={brand}
              options={[{ value: '', label: 'All brands' }, ...brands.map((b) => ({ value: b, label: b }))]}
              onChange={setBrand}
            />
          )}
        </div>
      </div>

      <div id="rel-panel" role="tabpanel" aria-labelledby={`rel-tab-${scope}`}>
        <ReleaseCalendar key={scope} drops={shown} scope={scope} view={view} />
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[0.72rem] text-[#595959]">
        <span aria-live="polite">{shown.length} of {drops.length} releases</span>
        <Link href="/drops/mine" className="min-h-[44px] content-center text-[#0A0A0A] underline-offset-4 hover:underline">My drops</Link>
        <a href={`${API_URL}/drops/calendar.ics`} className="min-h-[44px] content-center text-[#0A0A0A] underline-offset-4 hover:underline">Add all to my calendar</a>
      </p>
    </div>
  );
}
