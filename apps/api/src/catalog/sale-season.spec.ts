import { describe, expect, it } from 'vitest';
import { saleSeasons } from './sale-season';

describe('saleSeasons', () => {
  it('marks a season on now and one that starts soon', () => {
    const s = saleSeasons(new Date('2026-11-02T06:00:00Z'));
    expect(s[0]).toMatchObject({ name: 'Diwali sales', state: 'now' });
    expect(s.find((x) => x.name === 'Black Friday')).toMatchObject({ state: 'soon', daysToStart: 18 });
  });
  it('drops seasons that are over or too far away', () => {
    const s = saleSeasons(new Date('2026-11-15T06:00:00Z'));
    expect(s.find((x) => x.name === 'Diwali sales')).toBeUndefined();
    expect(s.find((x) => x.name === 'Republic Day sales')).toBeUndefined();
  });
});
