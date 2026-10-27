import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { priceSnapshots } from '../db/schema';
import type { PriceSnapshotInput } from '../retailers/retailer-adapter.interface';

/** A placeholder listing from a seed or a fixture adapter (its URL contains FIXTURE): it is stored as history, never as current. */
export const isFixtureListing = (listingUrl: string | null | undefined): boolean => (listingUrl ?? '').includes('FIXTURE');

/**
 * Which inputs of a bulk write end up with is_latest = true: the last REAL input per variant/retailer.
 * A FIXTURE input never gets the flag and never displaces a real current row.
 */
export function latestFlags(inputs: PriceSnapshotInput[]): boolean[] {
  const key = (s: PriceSnapshotInput) => `${s.sneakerVariantId}|${s.retailerId}`;
  const lastIndex = new Map<string, number>();
  inputs.forEach((s, i) => {
    if (!isFixtureListing(s.listingUrl)) lastIndex.set(key(s), i);
  });
  return inputs.map((s, i) => lastIndex.get(key(s)) === i);
}

@Injectable()
export class PriceSnapshotService {
  private readonly logger = new Logger(PriceSnapshotService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * Appends a snapshot and moves the is_latest flag onto it.
   *
   * Both statements run in one transaction: a crash between them would
   * otherwise leave a variant with either two current prices or none,
   * and every "best price" read would be wrong until the next fetch.
   *
   * The table is append-only by design — the previous row keeps its
   * price and timestamp, it just stops being current.
   */
  async record(input: PriceSnapshotInput): Promise<{ id: string }> {
    const fixture = isFixtureListing(input.listingUrl);
    return this.db.transaction(async (tx) => {
      // A FIXTURE placeholder is kept as history only: it neither becomes current nor knocks a real current row off.
      if (!fixture) {
        await tx
          .update(priceSnapshots)
          .set({ isLatest: false })
          .where(
            and(
              eq(priceSnapshots.sneakerVariantId, input.sneakerVariantId),
              eq(priceSnapshots.retailerId, input.retailerId),
              eq(priceSnapshots.isLatest, true),
            ),
          );
      }

      const [row] = await tx
        .insert(priceSnapshots)
        .values({ ...input, isLatest: !fixture })
        .returning({ id: priceSnapshots.id });

      // An INSERT ... RETURNING that comes back empty means the row went
      // nowhere — most likely no partition accepted it. Better to fail the
      // job loudly than to report a snapshot that was never stored.
      if (!row) throw new Error(`price_snapshots insert returned no row for variant ${input.sneakerVariantId}`);

      this.logger.log(
        `snapshot ${row.id} variant=${input.sneakerVariantId} ${input.currency} ${input.price} in_stock=${input.inStock}`,
      );
      return row;
    });
  }

  /**
   * Bulk version of record() for imports: same result as calling record() for
   * each input in order, but in batched statements inside one transaction
   * (a 66k-row daily import was ~130k round trips one at a time).
   *
   * When the same variant/retailer appears more than once, the last input is
   * the one left with is_latest = true, exactly as sequential record() calls.
   */
  async recordMany(inputs: PriceSnapshotInput[], batchSize = 1000): Promise<number> {
    if (inputs.length === 0) return 0;
    const key = (s: PriceSnapshotInput) => `${s.sneakerVariantId}|${s.retailerId}`;
    const flags = latestFlags(inputs);

    await this.db.transaction(async (tx) => {
      for (let start = 0; start < inputs.length; start += batchSize) {
        const batch = inputs.slice(start, start + batchSize);
        // Only pairs that get a new real current row release the old one; FIXTURE-only pairs leave it alone.
        const pairs = [...new Map(batch.filter((_, j) => flags[start + j]).map((s) => [key(s), s])).values()];
        if (pairs.length > 0) await tx.execute(sql`
          UPDATE price_snapshots ps SET is_latest = false
          FROM (VALUES ${sql.join(
            pairs.map((p) => sql`(${p.sneakerVariantId}::uuid, ${p.retailerId}::uuid)`),
            sql`, `,
          )}) AS v(variant_id, retailer_id)
          WHERE ps.sneaker_variant_id = v.variant_id AND ps.retailer_id = v.retailer_id AND ps.is_latest = true
        `);
        const rows = await tx
          .insert(priceSnapshots)
          .values(batch.map((s, j) => ({ ...s, isLatest: flags[start + j] })))
          .returning({ id: priceSnapshots.id });
        // Same guard as record(): rows that no partition accepted must fail the import, not vanish.
        if (rows.length !== batch.length) {
          throw new Error(`price_snapshots bulk insert stored ${rows.length} of ${batch.length} rows`);
        }
      }
    });
    this.logger.log(`recorded ${inputs.length} snapshots in bulk`);
    return inputs.length;
  }

  /**
   * Clears is_latest for a variant/retailer with no successful fetch to
   * replace it — a mapping that was removed, or a manual entry gone
   * stale past MAX_AGE_DAYS. Without this, a PermanentFetchError just
   * dead-letters the job and the *previous* snapshot keeps reporting
   * is_latest=true forever, so the price page keeps showing a retailer
   * offer (and a "View Deal" link) for data that no longer exists —
   * found on Day 20 when correcting two placeholder Superkicks/VegNonVeg
   * listing_urls: deleting the bad manual_price_entries rows didn't stop
   * the old fixture-URL snapshot from still being served as current.
   */
  async retract(retailerId: string, sneakerVariantId: string): Promise<void> {
    await this.db
      .update(priceSnapshots)
      .set({ isLatest: false })
      .where(
        and(
          eq(priceSnapshots.sneakerVariantId, sneakerVariantId),
          eq(priceSnapshots.retailerId, retailerId),
          eq(priceSnapshots.isLatest, true),
        ),
      );
  }
}
