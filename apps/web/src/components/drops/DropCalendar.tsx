'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cx } from '@chosn/ui';
import type { DropListItem } from '@/lib/drops';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const STATUS_DOT: Record<DropListItem['status'], string> = {
  live: 'bg-brass',
  upcoming: 'bg-text-faint',
  sold_out: 'bg-moss/40',
};

/**
 * Month grid with a drop indicator dot per day (task 1). Clicking a day
 * selects it, filtering the drop list rendered below the grid by this
 * component's caller — the calendar itself only owns which day is
 * selected, not how that selection is displayed, so the caller decides
 * (a filtered `DropListView`, in this page's case).
 */
export function DropCalendar({
  drops,
  onSelectDay,
  selectedDate,
}: {
  drops: DropListItem[];
  onSelectDay: (date: string | null) => void;
  selectedDate: string | null;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const dropsByDate = useMemo(() => {
    const map = new Map<string, DropListItem[]>();
    for (const drop of drops) {
      const existing = map.get(drop.releaseDate);
      if (existing) existing.push(drop);
      else map.set(drop.releaseDate, [drop]);
    }
    return map;
  }, [drops]);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function changeMonth(delta: number) {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
    onSelectDay(null); // a day selected in the previous month view has nothing to mean here
  }

  return (
    <div className="border border-moss/20 bg-vault-raised p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
          className="px-2 py-1 font-mono text-body text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
        >
          ‹
        </button>
        <p className="font-display text-body font-semibold text-text">
          {firstOfMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
          className="px-2 py-1 font-mono text-body text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 font-mono text-meta uppercase text-text-faint">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="py-1 text-center">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateKey = toDateKey(viewYear, viewMonth, day);
          const dayDrops = dropsByDate.get(dateKey) ?? [];
          const isSelected = selectedDate === dateKey;
          const isToday = dateKey === toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : dateKey)}
              disabled={dayDrops.length === 0}
              className={cx(
                'flex aspect-square flex-col items-center justify-center gap-1 border font-mono text-data-inline transition-colors duration-150 ease-chosn disabled:cursor-default',
                isSelected
                  ? 'border-brass bg-brass text-vault'
                  : isToday
                    ? 'border-moss text-text'
                    : 'border-transparent text-text-soft hover:border-moss/40',
              )}
            >
              <span>{day}</span>
              {dayDrops.length > 0 && (
                <span className="flex gap-0.5" aria-hidden="true">
                  {dayDrops.slice(0, 3).map((d) => (
                    <span key={d.id} className={cx('h-1 w-1 rounded-full', isSelected ? 'bg-vault' : STATUS_DOT[d.status])} />
                  ))}
                </span>
              )}
              <span className="sr-only">{dayDrops.length > 0 ? `${dayDrops.length} drop(s)` : 'No drops'}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-meta text-text-faint">
        <Link href="/notifications" className="underline decoration-moss/40 underline-offset-4 hover:text-text-soft">
          Manage your notifications
        </Link>{' '}
        to get alerted before a day like this fills up.
      </p>
    </div>
  );
}
