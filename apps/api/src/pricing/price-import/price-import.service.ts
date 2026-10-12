import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../../db/drizzle.provider';
import { manualPriceEntries, retailers, sneakerVariants, sneakers } from '../../db/schema';
import { MarketIntelligenceService } from '../market-intelligence.service';
import { PriceSnapshotService } from '../price-snapshot.service';
import { parsePriceCsv, slugify, type PriceRow, type RowError } from './price-csv';

export interface ImportSummary {
  dryRun: boolean;
  rowsRead: number;
  rowsImported: number;
  newSneakers: number;
  newVariants: number;
  newRetailers: string[];
  pricesRecorded: number;
  errors: RowError[];
  /** First rows as they will appear, for the preview table. */
  preview: Array<Pick<PriceRow, 'line' | 'brand' | 'model' | 'colorway' | 'styleCode' | 'size' | 'retailer' | 'price' | 'shipping' | 'inStock'>>;
}

/**
 * Writes CSV rows as real prices.
 *
 * For each row: find-or-create the sneaker (by style code), the size variant
 * and the store, append a manual_price_entries row (the audit trail: who
 * entered what, when) and record a price snapshot so it shows on the Compare
 * page immediately.
 *
 * Deliberately NOT created: retailer_product_mappings. The scheduled manual
 * fetch only runs for mapped products, and it would dead-letter every size
 * that has no entry yet. Imported prices instead age out on the page itself
 * (offers carry fetchedAt + the store's fetch frequency, and the UI shows a
 * stale warning), so nothing is ever presented as fresher than it is. Re-upload
 * to refresh.
 */
@Injectable()
export class PriceImportService {
  private readonly logger = new Logger(PriceImportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly snapshots: PriceSnapshotService,
    private readonly marketIntelligence: MarketIntelligenceService,
  ) {}

  async importCsv(csv: string, opts: { dryRun: boolean; recordedBy: string }): Promise<ImportSummary> {
    const { rows, errors } = parsePriceCsv(csv);
    const rowsRead = rows.length + errors.filter((e) => e.line > 1).length;

    const existingStores = await this.db.select({ id: retailers.id, slug: retailers.slug, name: retailers.name }).from(retailers);
    const storeBySlug = new Map(existingStores.map((s) => [s.slug, s]));
    const storeByName = new Map(existingStores.map((s) => [s.name.toLowerCase(), s]));
    const resolveStore = (name: string) => storeByName.get(name.toLowerCase()) ?? storeBySlug.get(slugify(name));

    const newRetailers = [...new Set(rows.filter((r) => !resolveStore(r.retailer)).map((r) => r.retailer))];
    const knownStyleCodes = new Set(
      (await this.db.select({ styleCode: sneakers.styleCode }).from(sneakers)).map((s) => s.styleCode),
    );
    const newStyleCodes = [...new Set(rows.map((r) => r.styleCode))].filter((c) => !knownStyleCodes.has(c));

    const summary: ImportSummary = {
      dryRun: opts.dryRun,
      rowsRead,
      rowsImported: 0,
      newSneakers: newStyleCodes.length,
      newVariants: 0,
      newRetailers,
      pricesRecorded: 0,
      errors,
      preview: rows.slice(0, 25).map(({ line, brand, model, colorway, styleCode, size, retailer, price, shipping, inStock }) => ({
        line, brand, model, colorway, styleCode, size, retailer, price, shipping, inStock,
      })),
    };

    // Nothing is written if any row is invalid: a half-applied sheet is worse than a clear "fix these lines".
    if (errors.length > 0 || rows.length === 0) return summary;

    if (opts.dryRun) {
      summary.rowsImported = rows.length;
      return summary;
    }

    const toSnapshot: Parameters<PriceSnapshotService['record']>[0][] = [];

    await this.db.transaction(async (tx) => {
      const sneakerIds = new Map<string, string>();
      const storeIds = new Map<string, string>();

      for (const r of rows) {
        // store
        const storeKey = r.retailer.toLowerCase();
        let storeId = storeIds.get(storeKey) ?? resolveStore(r.retailer)?.id;
        if (!storeId) {
          const [created] = await tx
            .insert(retailers)
            .values({
              name: r.retailer,
              slug: slugify(r.retailer),
              baseUrl: new URL(r.url).origin,
              integrationType: 'manual',
              regionFocus: 'india',
              fetchFrequencyMinutes: 10_080, // weekly: after that the page flags the price as stale
              status: 'active',
            })
            .onConflictDoNothing()
            .returning({ id: retailers.id });
          if (created) storeId = created.id;
          else {
            const [again] = await tx.select({ id: retailers.id }).from(retailers).where(eq(retailers.slug, slugify(r.retailer)));
            storeId = again!.id;
          }
        }
        storeIds.set(storeKey, storeId);

        // sneaker
        let sneakerId = sneakerIds.get(r.styleCode);
        if (!sneakerId) {
          await tx
            .insert(sneakers)
            .values({ brand: r.brand, model: r.model, colorway: r.colorway, styleCode: r.styleCode })
            .onConflictDoNothing({ target: sneakers.styleCode });
          const [s] = await tx.select({ id: sneakers.id }).from(sneakers).where(eq(sneakers.styleCode, r.styleCode));
          sneakerId = s!.id;
          sneakerIds.set(r.styleCode, sneakerId);
        }

        // size variant
        const [existingVariant] = await tx
          .select({ id: sneakerVariants.id })
          .from(sneakerVariants)
          .where(
            and(
              eq(sneakerVariants.sneakerId, sneakerId),
              eq(sneakerVariants.size, String(r.size)),
              eq(sneakerVariants.sizeSystem, r.sizeSystem),
              eq(sneakerVariants.region, 'india'),
            ),
          );
        let variantId = existingVariant?.id;
        if (!variantId) {
          const [created] = await tx
            .insert(sneakerVariants)
            .values({ sneakerId, size: String(r.size), sizeSystem: r.sizeSystem, region: 'india' })
            .returning({ id: sneakerVariants.id });
          variantId = created!.id;
          summary.newVariants += 1;
        }

        // audit row (append-only)
        await tx.insert(manualPriceEntries).values({
          retailerId: storeId,
          sneakerVariantId: variantId,
          price: String(r.price),
          shippingCost: String(r.shipping),
          currency: 'INR',
          condition: r.condition,
          inStock: r.inStock,
          listingUrl: r.url,
          imageUrl: r.imageUrl,
          recordedBy: opts.recordedBy,
          notes: `CSV import, line ${r.line}`,
        });

        toSnapshot.push({
          sneakerVariantId: variantId,
          retailerId: storeId,
          price: String(r.price),
          shippingCost: String(r.shipping),
          currency: 'INR',
          condition: r.condition,
          priceType: 'retail',
          inStock: r.inStock,
          listingUrl: r.url,
          imageUrl: r.imageUrl,
          authenticityVerified: false,
          fetchedAt: new Date(),
        });
      }
    });

    // Snapshots go in after the audit rows commit; each one flips is_latest atomically (see PriceSnapshotService).
    for (const s of toSnapshot) {
      await this.snapshots.record(s);
      summary.pricesRecorded += 1;
    }
    summary.rowsImported = rows.length;

    // The Compare grid reads best price / signal from Market Intelligence (normally refreshed hourly):
    // recompute now so the new prices show up straight away. A failure here must not undo the import.
    try {
      await this.marketIntelligence.refreshAll();
    } catch (err) {
      this.logger.warn(`CSV import saved, but the market-intelligence refresh failed: ${(err as Error).message}`);
    }
    this.logger.log(
      `CSV import by ${opts.recordedBy}: ${summary.rowsImported} prices, ${summary.newSneakers} new sneakers, ${summary.newVariants} new sizes, ${newRetailers.length} new stores`,
    );
    return summary;
  }
}
