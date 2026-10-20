'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cx } from '@chosn/ui';
import type { DropListItem, DropStatus } from '@/lib/drops';
import { API_URL } from '@/lib/watch';
import { DropCalendar } from './DropCalendar';

const REGION_CHIPS: Array<[string | null, string]> = [
  [null, 'All regions'],
  ['india', 'India'],
  ['us', 'US'],
  ['global', 'Global'],
];

type StatusFilter = 'all' | DropStatus;

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'sold_out', label: 'Released' },
];

/**
 * The calendar/list toggle. List is the default view (flagged assumption
 * from the original brief): it's scannable immediately, while a calendar
 * needs a moment to orient. Flip the initial `useState` to change it.
 */
export function DropsExplorer({ drops }: { drops: DropListItem[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [brand, setBrand] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  const brands = useMemo(() => Array.from(new Set(drops.map((d) => d.sneaker.brand))).sort(), [drops]);
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: drops.length, live: 0, upcoming: 0, sold_out: 0 };
    for (const d of drops) c[d.status] += 1;
    return c;
  }, [drops]);

  const filtered = useMemo(
    () => drops.filter((d) => (status === 'all' || d.status === status) && (!brand || d.sneaker.brand === brand) && (!region || d.regions.includes(region))),
    [drops, status, brand, region],
  );
  const visibleDrops = useMemo(
    () => (selectedDate ? filtered.filter((d) => d.releaseDate === selectedDate) : filtered),
    [filtered, selectedDate],
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div />
          <div className="flex flex-wrap items-center gap-4 font-mono text-meta text-text-faint">
            <Link href="/drops/mine" className="min-h-[44px] content-center text-brass-bright underline-offset-4 hover:underline">My drops</Link>
            <a href={`${API_URL}/drops/calendar.ics`} className="min-h-[44px] content-center text-brass-bright underline-offset-4 hover:underline">Add all to my calendar</a>
            <p aria-live="polite">
              {visibleDrops.length} of {drops.length} drops
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((c) => (
              <Chip key={c.value} active={status === c.value} onClick={() => setStatus(c.value)}>
                {c.label} <span className="ml-1 opacity-70">{counts[c.value]}</span>
              </Chip>
            ))}
          </div>
          <div role="group" aria-label="Filter by region" className="flex flex-wrap gap-2">
            {REGION_CHIPS.map(([v, l]) => (
              <Chip key={String(v)} active={region === v} onClick={() => setRegion(v)}>
                {l}
              </Chip>
            ))}
          </div>
          {brands.length > 1 && (
            <div role="group" aria-label="Filter by brand" className="flex flex-wrap gap-2">
              <Chip active={brand === null} onClick={() => setBrand(null)}>
                All brands
              </Chip>
              {brands.map((b) => (
                <Chip key={b} active={brand === b} onClick={() => setBrand(brand === b ? null : b)}>
                  {b}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      <DropCalendar drops={filtered} selectedDate={selectedDate} onSelectDay={setSelectedDate} />


    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[44px] items-center rounded-full border px-4 font-mono text-data-delta font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:min-h-[36px]',
        active
          ? 'border-brass-bright/60 bg-brass/15 text-brass-bright'
          : 'border-text/[0.12] text-text-soft hover:border-text/30 hover:text-text',
      )}
    >
      {children}
    </button>
  );
}
