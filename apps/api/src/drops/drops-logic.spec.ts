import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl, type CalendarDrop } from './drop-calendar';
import { nameTokens, sameRelease } from './drop-names';
import { inIndiaTime, releaseInstant, reminderDueAt } from './drop-time';

describe('releaseInstant', () => {
  it('reads an India clock time', () => {
    expect(releaseInstant({ date: '2026-07-09', time: '18:00', timezone: 'Asia/Kolkata' })?.toISOString()).toBe('2026-07-09T12:30:00.000Z');
  });

  it('converts a US Eastern time, with daylight saving', () => {
    // 23 Oct 2026 is still daylight time (UTC-4); 5 Nov 2026 is standard time (UTC-5).
    expect(releaseInstant({ date: '2026-10-23', time: '10:00', timezone: 'America/New_York' })?.toISOString()).toBe('2026-10-23T14:00:00.000Z');
    expect(releaseInstant({ date: '2026-11-05', time: '10:00:00', timezone: 'America/New_York' })?.toISOString()).toBe('2026-11-05T15:00:00.000Z');
  });

  it('has no instant for a date-only drop', () => {
    expect(releaseInstant({ date: '2026-11-14', time: null, timezone: 'Asia/Kolkata' })).toBeNull();
  });
});

describe('inIndiaTime', () => {
  it('shows a US drop in Indian time', () => {
    expect(inIndiaTime({ date: '2026-11-05', time: '10:00', timezone: 'America/New_York' })).toBe('Thu, 5 Nov, 8:30 PM IST');
  });

  it('says date only when there is no time', () => {
    expect(inIndiaTime({ date: '2026-11-14', time: null, timezone: 'Asia/Kolkata' })).toContain('(date only)');
  });
});

describe('reminderDueAt', () => {
  it('counts back from a timed drop', () => {
    const w = { date: '2026-11-05', time: '10:00', timezone: 'America/New_York' };
    expect(reminderDueAt(w, 15)?.toISOString()).toBe('2026-11-05T14:45:00.000Z');
    expect(reminderDueAt(w, 1440)?.toISOString()).toBe('2026-11-04T15:00:00.000Z');
  });

  it('sends a date-only drop one reminder, at 9:00 IST the day before', () => {
    const w = { date: '2026-11-14', time: null, timezone: 'Asia/Kolkata' };
    expect(reminderDueAt(w, 1440)?.toISOString()).toBe('2026-11-13T03:30:00.000Z');
    expect(reminderDueAt(w, 15)).toBeNull();
  });
});

const drop: CalendarDrop = {
  id: 'abc',
  title: 'Nike Air Force 1 Low, "Team Red"',
  date: '2026-10-21',
  time: null,
  timezone: 'Asia/Kolkata',
  level: 'Reported',
  price: 'about ₹13,290 (US $140)',
  regions: 'us',
  source: 'SoleDispatch',
  url: 'https://soledispatch.com/x',
};

describe('calendar files', () => {
  it('builds an all-day event and escapes commas', () => {
    const ics = buildIcs([drop], 'CHOSN drops', new Date('2026-10-20T00:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261021');
    expect(ics).toContain('DTEND;VALUE=DATE:20261022');
    expect(ics).toContain('Air Force 1 Low\\, "Team Red" (reported)');
    expect(ics).toContain('BEGIN:VALARM');
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });

  it('builds a timed event in UTC', () => {
    const ics = buildIcs([{ ...drop, time: '19:00' }]);
    expect(ics).toContain('DTSTART:20261021T133000Z');
    expect(ics).toContain('DTEND:20261021T143000Z');
  });

  it('makes a Google Calendar link', () => {
    const url = googleCalendarUrl(drop);
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('dates=20261021%2F20261022');
  });
});

describe('sameRelease', () => {
  const a = { brand: 'Nike', model: 'Air Force 1 Low 2026 x Oregon Ducks', colorway: 'Oregon Ducks', date: '2026-11-21' };
  const b = { brand: 'Nike', model: 'Oregon Ducks Nike Air Force 1 Low 2026', colorway: 'Default', date: '2026-11-21' };

  it('matches the same release written two ways', () => {
    expect(sameRelease(a, b)).toBe(true);
  });

  it('does not merge different shoes or different days', () => {
    expect(sameRelease(a, { ...b, model: 'Air Force 1 Low Pine Green', colorway: 'Pine Green' })).toBe(false);
    expect(sameRelease(a, { ...b, date: '2026-11-28' })).toBe(false);
  });

  it('ignores filler words', () => {
    expect([...nameTokens('Nike', 'Air Jordan 4 Retro OG', 'Default')]).toEqual(['air', '4']);
  });
});
