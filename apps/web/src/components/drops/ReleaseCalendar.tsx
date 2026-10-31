'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@chosn/ui';
import type { DropListItem } from '@/lib/drops';
import { ReleaseRow } from './ReleaseRow';

export type CalendarView = 'month' | 'week' | 'list';
type Scope = 'india' | 'elsewhere';

/* Dates are plain "YYYY-MM-DD" keys; all arithmetic runs in UTC so server and browser always agree. */
const pad = (n: number) => String(n).padStart(2, '0');
const parse = (k: string): [number, number, number] => {
  const [y, m, d] = k.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
};
const toKey = (t: Date) => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
const at = (k: string) => {
  const [y, m, d] = parse(k);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (k: string, n: number) => toKey(new Date(at(k).getTime() + n * 86400000));
const monthOf = (k: string) => k.slice(0, 7);
const addMonths = (k: string, n: number) => {
  const [y, m] = parse(k);
  return toKey(new Date(Date.UTC(y, m - 1 + n, 1)));
};
const mondayOf = (k: string) => addDays(k, -((at(k).getUTCDay() + 6) % 7));
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => at(k).toLocaleDateString('en-IN', { ...o, timeZone: 'UTC' });
const longDate = (k: string) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthName = (k: string) => fmt(k, { month: 'long', year: 'numeric' });
const plural = (n: number, w = 'release') => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Today in India, the same on the server and in any browser. */
export const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2';
const iconBtn = cx('flex h-11 w-11 items-center justify-center rounded-full border border-[#0A0A0A]/15 text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A]/[0.06] disabled:pointer-events-none disabled:opacity-30', ring);

function DayGroup({ date, list, scope, today, bare }: { date: string; list: DropListItem[]; scope: Scope; today: string; bare?: boolean }) {
  return (
    <section aria-label={longDate(date)}>
      <h3 className={cx('mb-2 flex items-baseline gap-2 px-1 text-[0.82rem] font-bold text-[#0A0A0A]', bare && 'sr-only')}>
        {fmt(date, { weekday: 'long', day: 'numeric', month: 'short' })}
        {date === today && <span className="rounded-full bg-[#9A5A00] px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-white">Today</span>}
        <span className="font-mono text-[0.62rem] font-normal uppercase tracking-[0.14em] text-[#595959]">{plural(list.length)}</span>
      </h3>
      <ul className="flex flex-col gap-2.5">
        {list.map((d) => (
          <ReleaseRow key={d.id} drop={d} scope={scope} />
        ))}
      </ul>
    </section>
  );
}

function groupByDate(drops: DropListItem[]): Array<[string, DropListItem[]]> {
  const m = new Map<string, DropListItem[]>();
  for (const d of drops) m.set(d.releaseDate, [...(m.get(d.releaseDate) ?? []), d]);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function Empty({ title, hint, action }: { title: string; hint?: string; action?: { label: string; run: () => void } }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-[#0A0A0A]/25 px-5 py-10 text-center">
      <p className="text-[1rem] font-bold text-[#0A0A0A]">{title}</p>
      {hint && <p className="max-w-md text-[0.85rem] text-[#404040]">{hint}</p>}
      {action && (
        <button type="button" onClick={action.run} className={cx('mt-2 inline-flex min-h-[44px] items-center rounded-full bg-[#0A0A0A] px-5 text-[0.85rem] font-semibold text-white hover:bg-[#333]', ring)}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * The release calendar for one scope (India, or released elsewhere). Month view: a grid with a dot per release and a count when busy;
 * pick a day and its releases open in a rounded sheet under the grid (with none picked, the sheet lists the whole month). Week view:
 * seven day blocks. List view: everything from today on, grouped by month with sticky month headings (earlier releases on request).
 * The bar with the title, Previous, Next and Today sticks under the site header.
 */
export function ReleaseCalendar({ drops, scope, view }: { drops: DropListItem[]; scope: Scope; view: CalendarView }) {
  const today = useMemo(todayKey, []);
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(today);
  const [showPast, setShowPast] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);

  const byDate = useMemo(() => new Map(groupByDate(drops)), [drops]);
  const dates = useMemo(() => [...byDate.keys()], [byDate]);
  const firstMonth = useMemo(() => (dates.length && dates[0]! < today ? monthOf(dates[0]!) : monthOf(today)), [dates, today]);
  const lastMonth = useMemo(() => (dates.length && dates[dates.length - 1]! > today ? monthOf(dates[dates.length - 1]!) : monthOf(today)), [dates, today]);

  const month = monthOf(anchor);
  const monthStart = `${month}-01`;
  const weekStart = mondayOf(anchor);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusKey}"]`)?.focus();
  }, [focusKey, anchor]);

  const step = (dir: -1 | 1) => {
    setPicked(null);
    if (view === 'week') setAnchor(addDays(weekStart, dir * 7));
    else setAnchor(addMonths(monthStart, dir));
  };
  const goToday = () => {
    setAnchor(today);
    setFocusKey(today);
    setPicked(null);
  };
  const canPrev = view === 'week' ? true : month > firstMonth;
  const canNext = view === 'week' ? true : month < lastMonth;

  const monthDrops = drops.filter((d) => monthOf(d.releaseDate) === month);
  const monthDays = groupByDate(monthDrops);
  const nextWith = dates.find((d) => d >= today);
  const lastWith = dates[dates.length - 1];
  const jump = (k: string) => {
    setAnchor(k);
    setFocusKey(k);
    setPicked(null);
  };

  const title = view === 'week' ? `${fmt(weekStart, { day: 'numeric', month: 'short' })} to ${fmt(addDays(weekStart, 6), { day: 'numeric', month: 'short', year: 'numeric' })}` : view === 'month' ? monthName(monthStart) : 'Releases';
  const count = view === 'week' ? drops.filter((d) => d.releaseDate >= weekStart && d.releaseDate <= addDays(weekStart, 6)).length : view === 'month' ? monthDrops.length : drops.filter((d) => showPast || d.releaseDate >= today).length;

  function onKey(e: KeyboardEvent<HTMLButtonElement>, key: string) {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (e.key in delta) next = addDays(key, delta[e.key]!);
    else if (e.key === 'Home') next = addDays(key, -((at(key).getUTCDay() + 6) % 7));
    else if (e.key === 'End') next = addDays(key, 6 - ((at(key).getUTCDay() + 6) % 7));
    else if (e.key === 'PageUp') next = addMonths(`${monthOf(key)}-01`, -1);
    else if (e.key === 'PageDown') next = addMonths(`${monthOf(key)}-01`, 1);
    if (!next) return;
    e.preventDefault();
    wantFocus.current = true;
    setFocusKey(next);
    if (monthOf(next) !== month) setAnchor(next);
  }

  /* Month grid */
  const lead = (at(monthStart).getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(parse(monthStart)[0], parse(monthStart)[1], 0)).getUTCDate();
  const cells: Array<string | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${pad(i + 1)}`)];
  const tabStop = monthOf(focusKey) === month ? focusKey : monthStart;

  const sheetDays = picked ? [[picked, byDate.get(picked) ?? []] as [string, DropListItem[]]] : monthDays;

  const listDays = groupByDate(drops.filter((d) => showPast || d.releaseDate >= today));
  const listMonths: Array<[string, Array<[string, DropListItem[]]>]> = [];
  for (const [date, list] of listDays) {
    const last = listMonths[listMonths.length - 1];
    if (last && last[0] === monthOf(date)) last[1].push([date, list]);
    else listMonths.push([monthOf(date), [[date, list]]]);
  }
  const hasPast = dates.some((d) => d < today);

  return (
    <div className="flex flex-col">
      {/* Sticky bar under the site header (4rem). */}
      <div className="sticky top-16 z-20 -mx-1 flex items-center gap-2 border-b border-[#0A0A0A]/10 bg-white/95 px-1 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        {view !== 'list' && (
          <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label={view === 'week' ? 'Previous week' : 'Previous month'} className={iconBtn}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1 text-center">
          <h3 aria-live="polite" className="truncate text-[1.1rem] font-extrabold leading-tight tracking-[-0.01em] text-[#0A0A0A] sm:text-[1.35rem]">{title}</h3>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[#595959]">{plural(count)}</p>
        </div>
        {view !== 'list' && (
          <>
            <button type="button" onClick={goToday} className={cx('min-h-[44px] rounded-full border border-[#0A0A0A]/15 px-4 text-[0.82rem] font-semibold text-[#0A0A0A] hover:bg-[#0A0A0A]/[0.06]', ring)}>
              Today
            </button>
            <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label={view === 'week' ? 'Next week' : 'Next month'} className={iconBtn}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {view === 'month' && (
        <div className="mt-4 flex flex-col gap-5">
          <div ref={grid} role="grid" aria-label={`${monthName(monthStart)} release calendar`} className="rounded-[24px] border border-[#0A0A0A]/10 bg-white p-2.5 sm:p-5">
            <div role="row" className="mb-1 grid grid-cols-7 text-center font-mono text-[0.62rem] uppercase tracking-[0.1em] text-[#595959]">
              {WEEKDAYS.map((w) => (
                <span key={w} role="columnheader" className="py-1">{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {cells.map((k, i) => {
                if (!k) return <span key={`e${i}`} aria-hidden />;
                const list = byDate.get(k) ?? [];
                const n = list.length;
                const isPicked = picked === k;
                const isToday = k === today;
                return (
                  <button
                    key={k}
                    type="button"
                    role="gridcell"
                    data-day={k}
                    tabIndex={k === tabStop ? 0 : -1}
                    aria-selected={isPicked}
                    aria-label={`${longDate(k)}, ${n ? plural(n) : 'no releases'}`}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => {
                      setPicked(isPicked ? null : k);
                      setFocusKey(k);
                    }}
                    onKeyDown={(e) => onKey(e, k)}
                    className={cx(
                      'relative flex h-12 min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[0.9rem] transition-colors sm:h-14',
                      ring,
                      isPicked ? 'bg-[#0A0A0A] text-white' : n ? 'font-bold text-[#0A0A0A] hover:bg-[#0A0A0A]/[0.07]' : 'text-[#595959] hover:bg-[#0A0A0A]/[0.04]',
                      isToday && !isPicked && 'ring-2 ring-[#9A5A00]',
                    )}
                  >
                    <span className="tabular-nums leading-none">{pad(parse(k)[2]).replace(/^0/, '')}</span>
                    {n > 0 && n <= 3 && (
                      <span aria-hidden className="flex gap-0.5">
                        {Array.from({ length: n }, (_, j) => (
                          <span key={j} className={cx('h-1.5 w-1.5 rounded-full', isPicked ? 'bg-white' : 'bg-[#0A0A0A]')} />
                        ))}
                      </span>
                    )}
                    {n > 3 && (
                      <span aria-hidden className={cx('rounded-full px-1.5 font-mono text-[0.58rem] font-bold leading-4', isPicked ? 'bg-white text-[#0A0A0A]' : 'bg-[#0A0A0A] text-white')}>{n}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#0A0A0A]/10 bg-[#F7F7F7] p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <h3 className="text-[1rem] font-extrabold text-[#0A0A0A]">{picked ? longDate(picked) : `All of ${fmt(monthStart, { month: 'long' })}`}</h3>
              {picked && (
                <button type="button" onClick={() => setPicked(null)} className={cx('min-h-[44px] rounded-full border border-[#0A0A0A]/20 px-4 text-[0.8rem] font-semibold', ring)}>
                  Show whole month
                </button>
              )}
            </div>
            {sheetDays.length === 0 || sheetDays.every(([, l]) => l.length === 0) ? (
              picked ? (
                <Empty title="No releases on this day" hint="Pick a day with a dot under the number." />
              ) : (
                <Empty
                  title={`No ${scope === 'india' ? 'India ' : ''}releases in ${monthName(monthStart)}`}
                  hint={dates.length === 0 ? 'Nothing is listed here yet. New dates appear as brands and trackers announce them.' : undefined}
                  action={
                    nextWith && monthOf(nextWith) !== month
                      ? { label: `Jump to the next release, ${fmt(nextWith, { day: 'numeric', month: 'short' })}`, run: () => jump(nextWith) }
                      : lastWith && monthOf(lastWith) !== month
                        ? { label: `Jump to the latest release, ${fmt(lastWith, { day: 'numeric', month: 'short' })}`, run: () => jump(lastWith) }
                        : undefined
                  }
                />
              )
            ) : (
              <div className="flex flex-col gap-5">
                {sheetDays.map(([date, list]) => (
                  <DayGroup key={date} date={date} list={list} scope={scope} today={today} bare={!!picked} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((k) => {
            const list = byDate.get(k) ?? [];
            return (
              <div key={k} className="rounded-[20px] border border-[#0A0A0A]/10 bg-[#F7F7F7] p-3 sm:p-4">
                {list.length ? (
                  <DayGroup date={k} list={list} scope={scope} today={today} />
                ) : (
                  <p className="flex items-baseline gap-2 px-1 text-[0.82rem] text-[#595959]">
                    <span className="font-bold text-[#0A0A0A]">{fmt(k, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                    {k === today && <span className="rounded-full bg-[#9A5A00] px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-white">Today</span>}
                    No releases
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div className="mt-2 flex flex-col">
          {listMonths.length === 0 ? (
            <div className="mt-4">
              <Empty
                title={`No upcoming ${scope === 'india' ? 'India ' : ''}releases`}
                hint={hasPast ? 'Everything we hold has already released.' : 'Nothing is listed here yet.'}
                action={hasPast ? { label: 'Show earlier releases', run: () => setShowPast(true) } : undefined}
              />
            </div>
          ) : (
            listMonths.map(([m, days]) => (
              <section key={m} aria-label={monthName(`${m}-01`)}>
                <h3 className="sticky top-[calc(4rem+4.25rem)] z-10 -mx-1 border-b border-[#0A0A0A]/10 bg-white px-1 py-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#0A0A0A]">{monthName(`${m}-01`)}</h3>
                <div className="flex flex-col gap-5 py-4">
                  {days.map(([date, list]) => (
                    <DayGroup key={date} date={date} list={list} scope={scope} today={today} />
                  ))}
                </div>
              </section>
            ))
          )}
          {hasPast && listMonths.length > 0 && (
            <button type="button" onClick={() => setShowPast((v) => !v)} className={cx('mx-auto mt-2 min-h-[44px] rounded-full border border-[#0A0A0A]/20 px-5 text-[0.85rem] font-semibold', ring)}>
              {showPast ? 'Hide earlier releases' : 'Show earlier releases'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
