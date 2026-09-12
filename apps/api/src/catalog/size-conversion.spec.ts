import { describe, expect, it } from 'vitest';
import { convertSize } from './size-conversion';

describe('convertSize', () => {
  it('returns the input unchanged for a same-system conversion', () => {
    expect(convertSize(9, 'uk', 'uk')).toBe(9);
  });

  it('converts UK 8 (the launch catalog default size) to the expected US/EU values', () => {
    expect(convertSize(8, 'uk', 'us')).toBe(9);
    expect(convertSize(8, 'uk', 'eu')).toBe(42.5);
  });

  it('is reversible for a value that sits exactly on the chart', () => {
    const us = convertSize(9, 'uk', 'us');
    expect(us).not.toBeNull();
    expect(convertSize(us!, 'us', 'uk')).toBe(9);
  });

  it('returns null for a value outside any real adult sneaker size', () => {
    expect(convertSize(45, 'uk', 'us')).toBeNull();
    expect(convertSize(0, 'us', 'eu')).toBeNull();
  });
});
