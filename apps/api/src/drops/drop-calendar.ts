import { releaseInstant, utcStamp } from './drop-time';

/** What the calendar files and links need from a drop. */
export interface CalendarDrop {
  id: string;
  title: string;
  date: string;
  time: string | null;
  timezone: string;
  level: 'Confirmed' | 'Reported' | 'Unconfirmed';
  price: string; // already formatted, e.g. "about ₹13,290 (US $140)" or "price TBA"
  regions: string;
  source: string | null;
  url: string | null;
}

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (l: string) => (l.length <= 74 ? l : l.match(/.{1,73}/g)!.join('\r\n '));

function describe(d: CalendarDrop): string {
  return `${d.level} date. ${d.price}. Regions: ${d.regions || 'n/a'}.${d.source ? ` Source: ${d.source}${d.url ? ` ${d.url}` : ''}.` : ''}`;
}

/** Start and end (UTC) of a timed drop, or the all-day range of a date-only one. */
function span(d: CalendarDrop): { start: string; end: string; allDay: boolean } {
  const at = releaseInstant({ date: d.date, time: d.time, timezone: d.timezone });
  if (at) return { start: utcStamp(at), end: utcStamp(new Date(at.getTime() + 3_600_000)), allDay: false };
  const next = new Date(`${d.date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: d.date.replace(/-/g, ''), end: next.toISOString().slice(0, 10).replace(/-/g, ''), allDay: true };
}

/** An iCalendar (.ics) file for any number of drops. */
export function buildIcs(drops: CalendarDrop[], name = 'CHOSN drops', now = new Date()): string {
  const stamp = utcStamp(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CHOSN//Drops//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Asia/Kolkata'];
  for (const d of drops) {
    const s = span(d);
    lines.push('BEGIN:VEVENT', `UID:${d.id}@chosn`, `DTSTAMP:${stamp}`);
    lines.push(s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART:${s.start}`, s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND:${s.end}`);
    lines.push(`SUMMARY:${esc(d.title)} (${d.level.toLowerCase()})`, `DESCRIPTION:${esc(describe(d))}`);
    // A day-before nudge inside the calendar app itself.
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${d.title} releases soon`)}`, `TRIGGER:${s.allDay ? '-PT15H' : '-PT15M'}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A link that opens "add to Google Calendar" with the drop filled in. */
export function googleCalendarUrl(d: CalendarDrop): string {
  const s = span(d);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${d.title} (${d.level.toLowerCase()})`, dates: `${s.start}/${s.end}`, details: describe(d) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
