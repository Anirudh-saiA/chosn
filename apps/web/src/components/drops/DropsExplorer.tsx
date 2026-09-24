'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, List, X } from 'lucide-react';
import { cx } from '@chosn/ui';
import type { DropListItem, DropStatus } from '@/lib/drops';
import { DropCalendar } from './DropCalendar';
import { DropFeatured, pickFeaturedDrop } from './DropFeatured';
import { DropListView } from './DropListView';

type ViewMode = 'list' | 'calendar';
type StatusFilter = 'all' | DropStatus;

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'sold_out', label: 'Sold out' },
];

/**
 * The calendar/list toggle. List is the default view (flagged assumption
 * from the original brief): it's scannable immediately, while a calendar
 * needs a moment to orient. Flip the initial `useState` to change it.
 */
export function DropsExplorer({ drops }: { drops: DropListItem[] }) {
  const [view, setView] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [brand, setBrand] = useState<string | null>(null);

  const featured = useMemo(() => pickFeaturedDrop(drops), [drops]);
  const brands = useMemo(() => Array.from(new Set(drops.map((d) => d.sneaker.brand))).sort(), [drops]);
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: drops.length, live: 0, upcoming: 0, sold_out: 0 };
    for (const d of drops) c[d.status] += 1;
    return c;
  }, [drops]);

  const filtered = useMemo(
    () => drops.filter((d) => (status === 'all' || d.status === status) && (!brand || d.sneaker.brand === brand)),
    [drops, status, brand],
  );
  const visibleDrops = useMemo(
    () => (selectedDate ? filtered.filter((d) => d.releaseDate === selectedDate) : filtered),
    [filtered, selectedDate],
  );

  return (
    <div className="flex flex-col gap-10">
      {featured && <DropFeatured drop={featured} />}

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="View" className="inline-flex border border-text/[0.12] bg-vault-raised/70">
            <ViewButton icon={<List className="h-4 w-4" aria-hidden />} label="List" active={view === 'list'} onClick={() => setView('list')} />
            <ViewButton
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
              label="Calendar"
              active={view === 'calendar'}
              onClick={() => setView('calendar')}
            />
          </div>
          <p className="font-mono text-meta text-text-faint" aria-live="polite">
            {visibleDrops.length} of {drops.length} drops
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((c) => (
              <Chip key={c.value} active={status === c.value} onClick={() => setStatus(c.value)}>
                {c.label} <span className="ml-1 opacity-70">{counts[c.value]}</span>
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

      {view === 'calendar' && <DropCalendar drops={filtered} selectedDate={selectedDate} onSelectDay={setSelectedDate} />}

      {selectedDate && (
        <p className="flex items-center gap-3 font-mono text-meta text-text-soft">
          Showing drops on {selectedDate}
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="inline-flex min-h-[44px] items-center gap-1 border border-text/[0.12] px-3 text-text-soft transition-colors hover:border-brass/60 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        </p>
      )}

      <DropListView drops={visibleDrops} />
    </div>
  );
}

function ViewButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[44px] items-center gap-2 px-4 font-sans text-ui-label font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice',
        active ? 'bg-brass-gradient text-vault-deep' : 'text-text-soft hover:text-text',
      )}
    >
      {icon}
      {label}
    </button>
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
