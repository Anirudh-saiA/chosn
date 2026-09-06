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
}
