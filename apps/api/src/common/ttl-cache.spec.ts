import { describe, expect, it } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('runs one computation for a burst of identical callers', async () => {
    const cache = new TtlCache<number>(1000);
    let calls = 0;
    const slow = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return 42;
    };
    const out = await Promise.all(Array.from({ length: 150 }, () => cache.get('k', slow)));
    expect(calls).toBe(1);
    expect(new Set(out)).toEqual(new Set([42]));
  });

  it('serves from cache until the TTL passes, then recomputes', async () => {
    let t = 0;
    const cache = new TtlCache<number>(1000, 10, () => t);
    let calls = 0;
    const f = async () => ++calls;
    expect(await cache.get('k', f)).toBe(1);
    t = 999;
    expect(await cache.get('k', f)).toBe(1);
    t = 1000;
    expect(await cache.get('k', f)).toBe(2);
  });

  it('keeps keys apart and never caches a failure', async () => {
    const cache = new TtlCache<string>(1000);
    await expect(cache.get('a', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await cache.get('a', async () => 'ok')).toBe('ok');
    expect(await cache.get('b', async () => 'other')).toBe('other');
  });

  it('stays within its size bound', async () => {
    const cache = new TtlCache<number>(60_000, 3);
    for (let i = 0; i < 10; i++) await cache.get(`k${i}`, async () => i);
    let recomputed = 0;
    await cache.get('k0', async () => ++recomputed); // oldest was dropped
    await cache.get('k9', async () => ++recomputed); // newest is still held
    expect(recomputed).toBe(1);
  });
});
