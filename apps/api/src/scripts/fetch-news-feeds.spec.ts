import { describe, expect, it } from 'vitest';
import { FEEDS, keep } from './fetch-news-feeds';

const feed = (name: string) => FEEDS.find((f) => f.name === name)!;

describe('feed filters', () => {
  it('drops the off-topic stories seen on 2026-10-23', () => {
    const ie = feed('Indian Express Lifestyle');
    expect(keep(ie, 'Why a tighter watch or shoe could signal a complication after cancer treatment', '')).toBe(false);
    expect(keep(ie, '‘35 to 40 grams of protein. Under Rs 500’: Fitness trainer shares daughter’s diet', '')).toBe(false);
    expect(keep(feed('Economic Times Retail'), 'Swiggy CEO says rival Blinkit aims to fix basics before expanding', '')).toBe(false);
    expect(keep(feed('Campus'), 'How to Style Sneakers for Men: 5 Outfits That Actually Work', '')).toBe(false);
    expect(keep(feed('Gear Patrol'), 'Dick’s Has Nike’s Max-Cushioned Vomero Plus for Well Below Retail', '')).toBe(false);
    expect(keep(feed('Esquire'), 'The 5 Shoes Every Man Should Own', '')).toBe(false);
  });

  it('keeps real sneaker and drop stories', () => {
    expect(keep(feed('Gear Patrol'), 'New Balance Delivers a New Definitive Take on Its Iconic Dad Shoe', '')).toBe(true);
    expect(keep(feed('Footwear News'), 'This Trio of Nike Air Max Sneakers Is Drawing Comparisons to Batman', '')).toBe(true);
    expect(keep(feed('Superkicks'), 'Nike Dunk Low drops this Saturday at Superkicks', '')).toBe(true);
    expect(keep(feed('Hypebeast'), 'Anything at all from a sneaker feed', '')).toBe(true);
  });

  it('matches brand names as whole words', () => {
    const f = feed('GQ');
    expect(keep(f, 'The basics of a capsule wardrobe', '')).toBe(false);
    expect(keep(f, 'ASICS and Kiko Kostadinov return', '')).toBe(true);
  });
});
