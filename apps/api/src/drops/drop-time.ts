/**
 * Release time helpers (pure, so they are tested). A drop is a calendar date, an optional clock time and the time zone that clock is in.
 * Rupees, India time and "when to remind" all come from here.
 */
export interface DropWhen {
  /** YYYY-MM-DD in the release time zone. */
  date: string;
  /** HH:MM or HH:MM:SS in the release time zone, or null when only the date is known. */
  time: string | null;
  /** IANA zone name of that clock, e.g. Asia/Kolkata or America/New_York. */
  timezone: string;
}

const IST = 'Asia/Kolkata';

/** The offset (in minutes) of a zone from UTC at a given instant. */
function offsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The exact moment (UTC) of a drop's clock time, or null when the drop has no time. Daylight saving is handled by the zone database. */
export function releaseInstant(w: DropWhen): Date | null {
  if (!w.time) return null;
  const [y, mo, d] = w.date.split('-').map(Number) as [number, number, number];
  const [h = 0, mi = 0] = w.time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset even across a daylight-saving change.
  let off = offsetMinutes(w.timezone, new Date(guess));
  off = offsetMinutes(w.timezone, new Date(guess - off * 60_000));
  return new Date(guess - off * 60_000);
}

const fmt = (at: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: IST, ...opts }).format(at);

/** "Sat 14 Nov, 8:30 PM IST" for a timed drop, or "Sat 14 Nov (date only)" when the time is not known. */
export function inIndiaTime(w: DropWhen): string {
  const at = releaseInstant(w);
  if (!at) {
    const day = new Date(`${w.date}T12:00:00Z`);
    return `${new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(day)} (date only)`;
  }
  return `${fmt(at, { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmt(at, { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()} IST`;
}

/**
 * When a reminder `minutesBefore` a drop should go out. A timed drop is reminded at the exact lead time. A date-only drop has no
 * minute to count back from, so a "1 day before" reminder goes at 9:00 AM IST the day before, and shorter ones are not possible (null).
 */
export function reminderDueAt(w: DropWhen, minutesBefore: number): Date | null {
  const at = releaseInstant(w);
  if (at) return new Date(at.getTime() - minutesBefore * 60_000);
  if (minutesBefore < 1440) return null;
  const [y, mo, d] = w.date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, d - 1, 9 - 5, 0 - 30)); // 9:00 IST the day before = 03:30 UTC
}

/** Compact UTC stamp for calendar files and links: 20261114T150000Z. */
export const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
