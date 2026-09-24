'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@chosn/ui';
import type { DropListItem } from '@/lib/drops';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const STATUS_DOT: Record<DropListItem['status'], string> = {
  live: 'bg-signal',
  upcoming: 'bg-brass-bright',
  sold_out: 'bg-text-faint',
};

/**
 * Month grid; days with drops glow. The calendar only owns which day is
 * selected — the caller decides how that filters the list. Keyboard: the
 * grid is one tab stop (roving tabindex); arrow keys move by day/week,
 * Home/End jump to the start/end of the month, Enter/Space selects.
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
  const [focusDay, setFocusDay] = useState(1);
  const cellRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

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
    setFocusDay(1);
    onSelectDay(null); // a day selected in the previous month has nothing to mean here
  }

  function moveFocus(next: number) {
    const clamped = Math.min(daysInMonth, Math.max(1, next));
    setFocusDay(clamped);
    cellRefs.current.get(clamped)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, day: number) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      moveFocus(day + (step[e.key] ?? 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus(daysInMonth);
    }
  }

  const monthLabel = firstOfMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthDropCount = cells.reduce<number>(
    (n, day) => n + (day ? (dropsByDate.get(toDateKey(viewYear, viewMonth, day))?.length ?? 0) : 0),
    0,
  );

  const navBtn =
    'flex h-11 w-11 items-center justify-center border border-text/[0.12] text-text-soft transition-colors hover:border-brass/60 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice';

  return (
    <div className="panel ticks p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className={navBtn}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="text-center">
          <p aria-live="polite" className="font-display text-2xl font-bold text-text">
            {monthLabel}
          </p>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">
            {monthDropCount} {monthDropCount === 1 ? 'drop' : 'drops'} this month
          </p>
        </div>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className={navBtn}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div role="group" aria-label={`Drops in ${monthLabel}`}>
        <div
          aria-hidden
          className="mb-1 grid grid-cols-7 gap-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-text-faint sm:gap-1.5"
        >
          {WEEKDAYS.map((label) => (
            <div key={label} className="py-1 text-center">
              <span className="sm:hidden">
                {label.slice(0, 1)}
              </span>
              <span className="hidden sm:inline">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} aria-hidden />;
            const dateKey = toDateKey(viewYear, viewMonth, day);
            const dayDrops = dropsByDate.get(dateKey) ?? [];
            const has = dayDrops.length > 0;
            const isSelected = selectedDate === dateKey;
            const isToday = dateKey === toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
            const label = `${new Date(viewYear, viewMonth, day).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}, ${has ? `${dayDrops.length} ${dayDrops.length === 1 ? 'drop' : 'drops'}` : 'no drops'}${isToday ? ', today' : ''}`;

            return (
              <div key={dateKey}>
                <button
                  type="button"
                  ref={(el) => {
                    if (el) cellRefs.current.set(day, el);
                    else cellRefs.current.delete(day);
                  }}
                  tabIndex={day === focusDay ? 0 : -1}
                  aria-label={label}
                  aria-pressed={has ? isSelected : undefined}
                  aria-disabled={!has}
                  onFocus={() => setFocusDay(day)}
                  onKeyDown={(e) => onKeyDown(e, day)}
                  onClick={() => has && onSelectDay(isSelected ? null : dateKey)}
                  className={cx(
                    'relative flex h-12 w-full flex-col items-center justify-center gap-1 border font-mono text-data-inline transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:h-16',
                    !has && 'cursor-default border-transparent text-text-faint',
                    has &&
                      !isSelected &&
                      'border-brass/40 bg-brass/[0.08] text-text shadow-[inset_0_0_18px_rgba(255,168,0,.18)] hover:border-brass hover:bg-brass/15 hover:shadow-glow-brass',
                    isSelected && 'border-brass-bright bg-brass-gradient font-semibold text-vault-deep shadow-glow-brass',
                    isToday && !isSelected && 'border-text/40',
                  )}
                >
                  <span>{day}</span>
                  {has && (
                    <span className="flex gap-0.5" aria-hidden="true">
                      {dayDrops.slice(0, 3).map((d) => (
                        <span
                          key={d.id}
                          className={cx('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-vault-deep' : STATUS_DOT[d.status])}
                        />
                      ))}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-text/[0.08] pt-4 text-meta text-text-faint">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.65rem] uppercase tracking-[0.12em]">
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden /> Live
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brass-bright" aria-hidden /> Upcoming
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-text-faint" aria-hidden /> Sold out
          </li>
        </ul>
        <p>
          <Link href="/notifications" className="text-brass-bright underline decoration-brass/40 underline-offset-4 hover:decoration-brass-bright">
            Manage your notifications
          </Link>{' '}
          to get alerted before a day fills up.
        </p>
      </div>
    </div>
  );
}
