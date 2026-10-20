import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { check } from './admin-drops.controller';

const good = { brand: 'Nike', model: 'Dunk Low', releaseDate: '2026-11-05', sourceName: 'Nike India', sourceUrl: 'https://www.nike.com/in' };

describe('admin drop validation', () => {
  it('accepts a complete new drop and maps it to columns', () => {
    const { drop, sneaker } = check({ ...good, releaseTime: '19:30', retailPrice: 10795, regions: ['india'] }, false);
    expect(drop).toMatchObject({ release_date: '2026-11-05', release_time: '19:30', retail_price: 10795, source_name: 'Nike India' });
    expect(sneaker).toMatchObject({ brand: 'Nike', model: 'Dunk Low' });
  });

  it.each([
    ['a bad date', { releaseDate: '05/11/2026' }],
    ['an impossible date', { releaseDate: '2026-13-45' }],
    ['a bad time', { releaseTime: '25:00' }],
    ['an unknown time zone', { timezone: 'Mars/Base' }],
    ['a negative price', { retailPrice: -5 }],
    ['a bad currency', { currency: 'rupees' }],
    ['an unknown region', { regions: ['mars'] }],
    ['an unknown status', { status: 'maybe' }],
    ['an http (not https) source link', { sourceUrl: 'http://example.com/x' }],
    ['an http picture link', { imageUrl: 'http://example.com/x.jpg' }],
    ['an empty brand', { brand: '   ' }],
  ])('rejects %s', (_name, patch) => {
    expect(() => check({ ...good, ...patch }, false)).toThrow(BadRequestException);
  });

  it('requires the source of a new drop but not of an edit', () => {
    expect(() => check({ brand: 'Nike', model: 'Dunk', releaseDate: '2026-11-05' }, false)).toThrow(/sourceName/);
    expect(check({ hidden: true }, true).drop).toEqual({ hidden: true });
  });

  it('keeps only valid purchase links, at most 10', () => {
    const links = [{ label: 'Nike', url: 'https://nike.com/x' }, { label: 'Bad', url: 'javascript:alert(1)' }, { label: 'Also bad', url: 'http://x.com' }];
    const { drop } = check({ ...good, links }, false);
    expect(JSON.parse(drop.purchase_links as string)).toEqual([{ label: 'Nike', url: 'https://nike.com/x' }]);
  });
});
