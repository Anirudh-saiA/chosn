import { describe, expect, it } from 'vitest';
import { MappingAssistService, type MatchTarget } from './mapping-assist.service';

const service = new MappingAssistService();

const DUNK: MatchTarget = {
  brand: 'Nike',
  model: 'Dunk',
  silhouette: 'Low Retro',
  colorway: 'White/Black (Panda)',
  styleCode: 'DD1391-100',
};

describe('MappingAssistService — real retailer title shapes', () => {
  it('scores a genuine match HIGH when the title includes the colorway nickname', () => {
    // Real title shape from 0002_seed_flipkart_and_test_set.sql's Flipkart seed.
    const result = service.scoreCandidate(DUNK, {
      title: 'Nike Dunk Low Retro White Black Panda',
      url: 'https://www.flipkart.com/p/x',
    });
    expect(result.confidence).toBe('high');
  });

  it('scores a title missing the colorway nickname MEDIUM, not HIGH — a real reviewable case, not an auto-match', () => {
    // Real title shape from 0003_day7_sources.sql's Myntra seed — omits
    // "Panda", the sneaker's informal name, which a human reviewer would
    // still confirm correctly but shouldn't be auto-accepted blind.
    const result = service.scoreCandidate(DUNK, {
      title: 'Nike Dunk Low Retro White Black',
      url: 'https://www.myntra.com/p/x',
    });
    expect(result.confidence).toBe('medium');
  });

  it('gives a style-code hit in the title a real boost', () => {
    const withoutCode = service.scoreCandidate(DUNK, {
      title: 'Nike Dunk Low Panda Sneakers',
      url: 'https://example.com/a',
    });
    const withCode = service.scoreCandidate(DUNK, {
      title: 'Nike Dunk Low Panda Sneakers DD1391-100',
      url: 'https://example.com/b',
    });
    expect(withCode.score).toBeGreaterThan(withoutCode.score);
  });

  it('rejects a candidate that never mentions the brand, regardless of text overlap', () => {
    const result = service.scoreCandidate(DUNK, {
      title: 'Low Top White Black Panda Print Canvas Shoe',
      url: 'https://example.com/c',
    });
    expect(result.confidence).toBe('no_confident_match');
    expect(result.score).toBe(0);
  });

  it('scores a same-brand, wrong-model listing below HIGH, not confidently matched', () => {
    // Real risk case task 3 warns about: same brand, different shoe.
    const result = service.scoreCandidate(DUNK, {
      title: 'Nike Air Force 1 07 Triple White',
      url: 'https://example.com/d',
    });
    expect(result.confidence).not.toBe('high');
  });

  it('suggestMatches ranks the true match first and caps at topN', () => {
    const candidates = [
      { title: 'Nike Air Force 1 07 White', url: 'https://example.com/1' },
      { title: 'adidas Samba OG White Black', url: 'https://example.com/2' },
      { title: 'Nike Dunk Low Panda Sneakers', url: 'https://example.com/3' },
      { title: 'Nike Dunk Low Retro - White/Black', url: 'https://example.com/4' },
      { title: 'New Balance 550 White Green', url: 'https://example.com/5' },
    ];
    const ranked = service.suggestMatches(DUNK, candidates, 3);
    expect(ranked).toHaveLength(3);
    const [first, second, third] = ranked;
    expect(first?.candidate.title).toMatch(/Dunk/);
    expect(first?.score ?? 0).toBeGreaterThanOrEqual(second?.score ?? 0);
    expect(second?.score ?? 0).toBeGreaterThanOrEqual(third?.score ?? 0);
  });
});
