import { describe, expect, it } from 'vitest';
import { categorize, detectBrands, findDuplicates, matchShoe, mentionsIndia, sameStory } from './news-logic';

describe('detectBrands', () => {
  it('finds brands in order of mention, with aliases and possessives', () => {
    expect(detectBrands('Nike’s “Plaid Pack” Dresses Four Classics in Red Tartan')).toEqual(['Nike']);
    expect(detectBrands('Air Jordan 1 and adidas Yeezy collide')).toEqual(['Jordan', 'adidas']);
    expect(detectBrands('Comet drops the Mules in Bonfire')).toEqual(['Comet']);
  });
  it('does not match inside other words', () => {
    expect(detectBrands('Salomonic wisdom, Nikeish vibes, a Vansittart story')).toEqual([]);
  });
});

describe('categorize', () => {
  it.each([
    ['Nike reports record quarter as revenue climbs', 'industry'],
    ['Sean Wotherspoon and Mizuno unveil a collab capsule', 'collab'],
    ['Nike Dunk Low "Panda" restock date and where to buy', 'release'],
    ['Rapper spotted wearing rare sneakers on tour', 'culture'],
    ['Kylie Jenner Makes Her Victoria’s Secret Runway Debut', 'culture'],
    ['Taylor Swift Channels Cinderella in Dior at the Academy Museum Gala', 'culture'],
    ['Nike unveils a new Pegasus at the fashion show', 'release'],
  ])('%s -> %s', (t, c) => expect(categorize(t)).toBe(c));
});

describe('mentionsIndia', () => {
  it('spots India, rupees, Indian stores and brands', () => {
    expect(mentionsIndia('Retail price ₹9,295 in India')).toBe(true);
    expect(mentionsIndia('Now at Superkicks')).toBe(true);
    expect(mentionsIndia('Gully Labs x Thums Up', ['Gully Labs'])).toBe(true);
    expect(mentionsIndia('Nike Dunk Low in the US')).toBe(false);
  });
});

describe('sameStory / findDuplicates', () => {
  it('treats reworded headlines of one release as the same', () => {
    expect(sameStory('Nike Air Max 90 SP "Black Leather" Strips Down the Classic Silhouette', 'Nike Air Max 90 SP Black Leather strips down the classic')).toBe(true);
    expect(sameStory('Nike Dunk Low Panda restocks', 'Salomon XT-6 Expedition Pack arrives')).toBe(false);
  });
  it('keeps our own writing, else the earliest, and ignores stories far apart in time', () => {
    const d = (s: string) => new Date(`2026-10-${s}T00:00:00Z`);
    const dup = findDuplicates([
      { id: 'a', title: 'Nike Air Max 90 SP Black Leather strips down the classic', publishedAt: d('10'), source: 'Hypebeast', external: true },
      { id: 'b', title: 'Nike Air Max 90 SP "Black Leather" Strips Down the Classic Silhouette', publishedAt: d('11'), source: 'Highsnobiety', external: true },
      { id: 'c', title: 'Nike Air Max 90 SP Black Leather strips down the classic silhouette', publishedAt: d('20'), source: 'SoleSavy', external: true },
      { id: 'own', title: 'Nike Air Max 90 SP Black Leather strips down the classic silhouette', publishedAt: d('12'), source: 'CHOSN', external: false },
    ]);
    expect(dup.get('a')).toBe('own');
    expect(dup.get('b')).toBe('own');
    expect(dup.has('c')).toBe(false); // ten days later: a separate story
    expect(dup.has('own')).toBe(false);
  });
});

describe('matchShoe', () => {
  const shoes = [
    { brand: 'Nike', model: 'Air Max 90' },
    { brand: 'Nike', model: 'Air Max 90 SP' },
    { brand: 'Nike', model: 'Dunk Low' },
    { brand: 'adidas', model: 'Samba OG' },
  ];
  it('picks the longest model whose words are all in the headline', () => {
    expect(matchShoe('Nike Air Max 90 SP "Black Leather" Strips Down the Classic', shoes)).toEqual({ brand: 'Nike', model: 'Air Max 90 SP' });
    expect(matchShoe('Nike Adds the Kobe Dunk Low Protro to its collection', shoes)).toEqual({ brand: 'Nike', model: 'Dunk Low' });
  });
  it('needs the brand, and does not match on one generic word', () => {
    expect(matchShoe('Samba OG returns in green', shoes)).toBeNull(); // brand not named
    expect(matchShoe('Nike boots up its Air plans', shoes)).toBeNull();
  });
});
