'use client';

import { useMemo, useState } from 'react';
import type { DropListItem } from '@/lib/drops';
import { DropCalendar } from './DropCalendar';
import { DropListView } from './DropListView';

type ViewMode = 'list' | 'calendar';

/**
 * The calendar/list toggle (flagged assumption, per the brief): **list
 * is the default view.** A list is scannable and reads top-to-bottom
 * immediately; a calendar needs a moment to orient to (which month,
 * which day has something) before it says anything. At today's catalog
 * size — a handful of drops — a calendar's main value is "does day X
 * have anything," which the list already answers just by being short.
 * The calendar becomes more valuable once there are enough drops that
 * scanning a month at a glance beats scrolling a list — worth
 * revisiting then, not a permanent call. Override by flipping the
 * initial `useState` value below.
 */
export function DropsExplorer({ drops }: { drops: DropListItem[] }) {
  const [view, setView] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const visibleDrops = useMemo(
    () => (selectedDate ? drops.filter((d) => d.releaseDate === selectedDate) : drops),
    [drops, selectedDate],
  );

  return (
    <div className="flex flex-col gap-8">
      <div role="tablist" aria-label="View" className="inline-flex w-fit border border-moss/25">
        <ViewTab label="List" active={view === 'list'} onClick={() => setView('list')} />
        <ViewTab label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
      </div>

      {view === 'calendar' && (
        <DropCalendar drops={drops} selectedDate={selectedDate} onSelectDay={setSelectedDate} />
      )}

      {selectedDate && (
        <p className="flex items-center gap-3 text-meta text-text-faint">
          Showing drops on {selectedDate}
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="underline decoration-moss/40 underline-offset-4 hover:text-text-soft"
          >
            Clear
          </button>
        </p>
      )}

      <DropListView drops={visibleDrops} />
    </div>
  );
}

function ViewTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'px-4 py-2 font-mono text-ui-label font-semibold transition-colors duration-150 ease-chosn ' +
        (active ? 'bg-brass text-vault' : 'text-text-soft hover:text-text')
      }
    >
      {label}
    </button>
  );
}
