import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { priceSnapshots } from '../db/schema';
import type { PriceSnapshotInput } from '../retailers/retailer-adapter.interface';

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
    return this.db.transaction(async (tx) => {
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

      const [row] = await tx
        .insert(priceSnapshots)
        .values({ ...input, isLatest: true })
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
