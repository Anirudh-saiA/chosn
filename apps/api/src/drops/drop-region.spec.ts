import { describe, expect, it } from 'vitest';
// The rules live in the web app (apps/web/src/lib/drop-region.ts, pure and import-free); tested here where vitest runs.
import { countryOf, isIndiaDrop, officialLinks, sourceLink } from '../../../web/src/lib/drop-region';

describe('isIndiaDrop', () => {
  it('counts India tags, confirmed India and in-Indian-stores', () => {
    expect(isIndiaDrop({ regions: ['india'] })).toBe(true);
    expect(isIndiaDrop({ regions: ['us'], indiaStatus: 'in_indian_stores' })).toBe(true);
    expect(isIndiaDrop({ regions: ['global'], indiaStatus: 'confirmed_india' })).toBe(true);
  });
  it('leaves everything else elsewhere', () => {
    expect(isIndiaDrop({ regions: ['us'], indiaStatus: 'unknown' })).toBe(false);
    expect(isIndiaDrop({ regions: ['global'], indiaStatus: 'global_only' })).toBe(false);
    expect(isIndiaDrop({ regions: [] })).toBe(false);
  });
});

describe('countryOf', () => {
  it('names a known country', () => expect(countryOf({ regions: ['us'] })).toMatchObject({ name: 'United States', code: 'US', vague: false }));
  it('says so when only worldwide is known', () => expect(countryOf({ regions: ['global'] }).vague).toBe(true));
  it('never guesses', () => expect(countryOf({ regions: [] })).toMatchObject({ name: 'Country not stated', vague: true }));
});

describe('officialLinks', () => {
  it('keeps https links on official hosts and uses the stored retailer name', () => {
    const l = officialLinks({ regions: ['us'], purchaseLinks: [{ url: 'https://www.nike.com/launch/t/dunk', retailer_name: 'Nike SNKRS' }] });
    expect(l).toEqual([{ url: 'https://www.nike.com/launch/t/dunk', host: 'nike.com', label: 'Nike SNKRS' }]);
  });
  it('drops http, look-alike hosts, non-official sites and junk', () => {
    const l = officialLinks({
      regions: ['us'],
      sourceUrl: 'https://www.sneakerfiles.com/x',
      purchaseLinks: [{ url: 'http://www.nike.com/x' }, { url: 'https://nike.com.evil.io/x' }, { url: 'https://evilnike.com/x' }, { url: 'javascript:alert(1)' }, { url: 5 }, null, 'x'],
    });
    expect(l).toEqual([]);
  });
  it('accepts an official source link and de-duplicates', () => {
    const l = officialLinks({ regions: ['us'], sourceUrl: 'https://www.adidas.co.in/samba', purchaseLinks: [{ url: 'https://www.adidas.co.in/samba' }] });
    expect(l).toHaveLength(1);
  });
  it('is empty with no links at all', () => expect(officialLinks({ regions: ['us'] })).toEqual([]));
});

describe('sourceLink', () => {
  it('returns a readable source, or null', () => {
    expect(sourceLink({ regions: [], sourceUrl: 'https://www.sneakerfiles.com/a', sourceName: 'SneakerFiles' })).toMatchObject({ name: 'SneakerFiles' });
    expect(sourceLink({ regions: [] })).toBeNull();
  });
});
