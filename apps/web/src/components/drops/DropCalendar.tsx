'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@chosn/ui';
import type { DropListItem } from '@/lib/drops';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';
import { DropCard } from './DropCard';
import { SneakerPlaceholderArt } from './SneakerPlaceholderArt';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function key(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** The little card that floats over a date: up to three shoes releasing that day. */
function Peek({ drops, align }: { drops: DropListItem[]; align: 'left' | 'center' | 'right' }) {
  return (
    <motion.div
      role="tooltip"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        'pointer-events-none absolute bottom-[calc(100%+10px)] z-30 w-56 rounded-2xl border border-text/10 bg-white p-2 shadow-[0_18px_40px_-12px_rgba(10,10,10,0.35)]',
        align === 'left' && 'left-0',
        align === 'right' && 'right-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
      )}
    >
      <ul className="flex flex-col gap-1.5">
        {drops.slice(0, 3).map((d) => (
          <li key={d.id} className="flex items-center gap-2.5">
            <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-text/[0.05]">
              <SneakerPlaceholderArt
                brand={d.sneaker.brand}
                model={d.sneaker.model}
                colorway={d.sneaker.colorway}
                imageUrl={resolveSneakerImage(d.sneaker.primaryImageUrl)}
                aspect="wide"
                className="!aspect-auto h-full w-full border-0"
              />
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate font-mono text-[0.58rem] uppercase tracking-[0.14em] text-text-faint">{d.sneaker.brand}</span>
              <span className="block truncate text-[0.8rem] font-semibold leading-tight text-text">{d.sneaker.model}</span>
            </span>
          </li>
        ))}
      </ul>
      {drops.length > 3 && <p className="mt-1.5 px-1 text-left font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-faint">+{drops.length - 3} more</p>}
    </motion.div>
  );
}

/**
 * A minimal month calendar. Days with drops are filled; hover one and the shoes float above it; click it and the calendar turns over to
 * show only that day's shoes, with a way back. The caller owns which day is selected.
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
  const reduce = useReducedMotion();
  const today = new Date();
  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hover, setHover] = useState<string | null>(null);
  const [dir, setDir] = useState(1);
  const root = useRef<HTMLDivElement>(null);

  // The day view is shorter than the month, so bring the card back into view when it turns over.
  useEffect(() => {
    const el = root.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [selectedDate, reduce]);

  const byDate = useMemo(() => {
    const map = new Map<string, DropListItem[]>();
    for (const d of drops) map.set(d.releaseDate, [...(map.get(d.releaseDate) ?? []), d]);
    return map;
  }, [drops]);

  const first = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells: Array<number | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthCount = cells.reduce<number>((n, day) => n + (day ? (byDate.get(key(viewYear, viewMonth, day))?.length ?? 0) : 0), 0);

  const atStart = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function go(delta: number) {
    setDir(delta);
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setHover(null);
  }

  const dayDrops = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const turn = reduce ? { duration: 0 } : { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };
  const nav = 'flex h-10 w-10 items-center justify-center rounded-full text-text-soft transition-colors hover:bg-text/[0.06] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice';

  return (
    <div ref={root} className="mx-auto w-full max-w-3xl scroll-mt-24 [perspective:1400px]">
      <AnimatePresence mode="wait" initial={false}>
        {selectedDate === null ? (
          <motion.div
            key="month"
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={turn}
            className="rounded-[2rem] border border-text/10 bg-white p-5 shadow-[0_24px_60px_-30px_rgba(10,10,10,0.35)] sm:p-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <button type="button" onClick={() => go(-1)} disabled={atStart} aria-label="Previous month" className={cx(nav, atStart && 'pointer-events-none opacity-30')}>
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <div className="text-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={monthLabel}
                    initial={{ opacity: 0, x: reduce ? 0 : dir * 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduce ? 0 : dir * -14 }}
                    transition={{ duration: 0.16 }}
                    aria-live="polite"
                    className="font-display text-2xl font-bold text-text"
                  >
                    {monthLabel}
                  </motion.p>
                </AnimatePresence>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-faint">
                  {monthCount} {monthCount === 1 ? 'drop' : 'drops'}
                </p>
              </div>
              <button type="button" onClick={() => go(1)} aria-label="Next month" className={nav}>
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div aria-hidden className="mb-2 grid grid-cols-7 text-center font-mono text-[0.7rem] text-text-faint">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1.5">
              {cells.map((day, i) => {
                if (day === null) return <span key={`e${i}`} aria-hidden />;
                const dk = key(viewYear, viewMonth, day);
                const list = byDate.get(dk) ?? [];
                const has = list.length > 0;
                const isToday = dk === todayKey;
                const col = (lead + day - 1) % 7;
                const align = col <= 1 ? 'left' : col >= 5 ? 'right' : 'center';
                const label = `${longDate(dk)}, ${has ? `${list.length} ${list.length === 1 ? 'drop' : 'drops'}` : 'no drops'}`;
                return (
                  <div key={dk} className="relative flex justify-center">
                    {has ? (
                      <motion.button
                        type="button"
                        aria-label={label}
                        onClick={() => onSelectDay(dk)}
                        onMouseEnter={() => setHover(dk)}
                        onMouseLeave={() => setHover((h) => (h === dk ? null : h))}
                        onFocus={() => setHover(dk)}
                        onBlur={() => setHover((h) => (h === dk ? null : h))}
                        whileHover={reduce ? undefined : { scale: 1.08 }}
                        whileTap={reduce ? undefined : { scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                        className={cx(
                          'relative flex h-11 w-11 items-center justify-center rounded-full bg-brass/20 font-mono text-[0.85rem] font-semibold text-text transition-colors hover:bg-brass hover:text-vault-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:h-12 sm:w-12',
                          isToday && 'ring-2 ring-text',
                        )}
                      >
                        {day}
                        {list.length > 1 && (
                          <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-text px-1 font-mono text-[0.55rem] text-white">
                            {list.length}
                          </span>
                        )}
                      </motion.button>
                    ) : (
                      <span
                        aria-label={label}
                        className={cx('flex h-11 w-11 items-center justify-center rounded-full font-mono text-[0.85rem] text-text-faint sm:h-12 sm:w-12', isToday && 'ring-1 ring-text/40')}
                      >
                        {day}
                      </span>
                    )}
                    <AnimatePresence>{has && hover === dk ? <Peek drops={list} align={align} /> : null}</AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="day"
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={turn}
            className="rounded-[2rem] border border-text/10 bg-white p-5 shadow-[0_24px_60px_-30px_rgba(10,10,10,0.35)] sm:p-8"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelectDay(null)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-text-soft transition-colors hover:bg-text/[0.06] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> Calendar
              </button>
              <div className="text-right">
                <p className="font-display text-xl font-bold text-text">{longDate(selectedDate)}</p>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-faint">
                  {dayDrops.length} {dayDrops.length === 1 ? 'drop' : 'drops'}
                </p>
              </div>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2">
              {dayDrops.map((d, i) => (
                <DropCard key={d.id} drop={d} index={i} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
