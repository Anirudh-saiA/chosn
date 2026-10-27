import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOOTWEAR_PATTERNS, classifyFootwear } from './footwear-type';

// Real titles from the catalogue (the 711 slides, 87 sandals and 499 "other" of the founder's card, plus sneakers that look close).
const SLIDES = [
  'ADILETTE 22 SLIDES', 'YEEZY SLIDE', 'FRANCHISE SLIDE', 'CALM MULES', 'HEX MULE', 'PURECHILL SLIDES', 'ECHO CLOG',
  'LEADCAT 2.0 PALERMO FOIL SLIDES', 'ADILETTE', 'SALEHE BEMBURY X POLLEX CLOG', 'POUCHYLETTE SLIDES', 'ADIFOM IIINFINITY MULES',
  'AIR JORDAN MULE SE', 'JORDAN BREAK SLIDE', 'CHUMBAK CLASSIC CLOG', 'SPEEDCAT MULE', 'VICTORI SLIDES', 'Foam Rubber Mules',
  'AIR MAX 90 SLIDES', 'ADIFOM STAN MULE W',
];
const SANDALS = ['CALM SANDALS', 'EQT93 SANDALS'];
const OTHER = [
  "KING ULTIMATE FG/AG Women's Football Boots", 'Waterproof Field Boot Wheat Nubuck', 'WALLABEE BOOT', 'FUTURE 9 MATCH FG/AG Football Boots',
];
const SNEAKERS = ['AIR FORCE 1 07', 'DUNK LOW RETRO', 'Landslide Runner', 'Sneaker Mule', 'SLIDE SNEAKER', 'SAMBA OG', 'Suede Classic XXI', 'AIR MAX 90'];

describe('classifyFootwear', () => {
  it.each(SLIDES)('slide: %s', (t) => expect(classifyFootwear(t)).toBe('slide'));
  it.each(SANDALS)('sandal: %s', (t) => expect(classifyFootwear(t)).toBe('sandal'));
  it.each(OTHER)('other (boots and the like): %s', (t) => expect(classifyFootwear(t)).toBe('other'));
  it.each(SNEAKERS)('sneaker: %s', (t) => expect(classifyFootwear(t)).toBe('sneaker'));

  it('uses the silhouette too', () => {
    expect(classifyFootwear('KING ULTIMATE', 'Football Boots')).toBe('other');
    expect(classifyFootwear('SOME NAME', null)).toBe('sneaker');
    expect(classifyFootwear(null, null)).toBe('sneaker');
  });

  it('a title that says sneaker stays a sneaker even with a slide word in it', () => {
    expect(classifyFootwear('Slide Sneaker')).toBe('sneaker');
    expect(classifyFootwear('Boot Sneakers')).toBe('sneaker');
  });

  it('matches whole words only', () => {
    expect(classifyFootwear('Landslide')).toBe('sneaker');
    expect(classifyFootwear('Bootcut Runner')).toBe('sneaker');
  });
});

describe('the migration and this file hold the same rule', () => {
  const sql = readFileSync(join(__dirname, '..', '..', 'drizzle', '0050_footwear_type.sql'), 'utf8');
  it.each(FOOTWEAR_PATTERNS)('%s pattern is in 0050_footwear_type.sql', (type, pattern) => {
    expect(sql).toContain(`t ~* '\\m${pattern}\\M' THEN '${type}'::footwear_type`);
  });
});
