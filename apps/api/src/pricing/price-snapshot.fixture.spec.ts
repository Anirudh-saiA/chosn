import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { isFixtureListing, latestFlags, PriceSnapshotService } from './price-snapshot.service';
import type { PriceSnapshotInput } from '../retailers/retailer-adapter.interface';

const snap = (variant: string, retailer: string, listingUrl: string): PriceSnapshotInput =>
  ({ sneakerVariantId: variant, retailerId: retailer, price: '100', currency: 'INR', inStock: true, listingUrl }) as PriceSnapshotInput;

describe('FIXTURE rows are never current (is_latest)', () => {
  it('detects a FIXTURE listing url', () => {
    expect(isFixtureListing('https://x.test/FIXTURE/1')).toBe(true);
    expect(isFixtureListing('https://www.superkicks.in/products/dunk')).toBe(false);
    expect(isFixtureListing(null)).toBe(false);
  });

  it('latestFlags: the last REAL input per variant/retailer is current, a FIXTURE one never is', () => {
    const flags = latestFlags([
      snap('v1', 'r1', 'https://s/real-1'),
      snap('v1', 'r1', 'https://s/FIXTURE-1'), // later, but a placeholder: must not take the flag
      snap('v2', 'r1', 'https://s/FIXTURE-2'), // fixture only: no current row at all
      snap('v3', 'r1', 'https://s/real-3'),
      snap('v3', 'r1', 'https://s/real-3b'),
    ]);
    expect(flags).toEqual([true, false, false, false, true]);
  });

  it('record(): a FIXTURE insert is stored with is_latest=false and does not clear the current real row', async () => {
    const inserted: Array<{ isLatest: boolean }> = [];
    const update = vi.fn();
    const tx = {
      update: (...a: unknown[]) => {
        update(...a);
        return { set: () => ({ where: async () => undefined }) };
      },
      insert: () => ({
        values: (v: { isLatest: boolean }) => {
          inserted.push(v);
          return { returning: async () => [{ id: 'x' }] };
        },
      }),
    };
    const svc = new PriceSnapshotService({ transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as never);
    await svc.record(snap('v1', 'r1', 'https://s/FIXTURE-9'));
    expect(inserted[0]?.isLatest).toBe(false);
    expect(update).not.toHaveBeenCalled();
    await svc.record(snap('v1', 'r1', 'https://s/real'));
    expect(inserted[1]?.isLatest).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
