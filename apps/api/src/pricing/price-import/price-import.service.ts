import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../../db/drizzle.provider';
import { manualPriceEntries, retailers, sneakerVariants, sneakers } from '../../db/schema';
import { MarketIntelligenceService } from '../market-intelligence.service';
import { PriceSnapshotService } from '../price-snapshot.service';
import { parsePriceCsv, slugify, type PriceRow, type RowError } from './price-csv';

/** Rows per batched statement: well under Postgres's 65535-parameter limit for the widest insert here (~11 columns). */
const BATCH = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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

  /** `refresh: false` skips the per-upload market-intelligence recompute (bulk loads refresh once at the end). */
  async importCsv(csv: string, opts: { dryRun: boolean; recordedBy: string; refresh?: boolean }): Promise<ImportSummary> {
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

    // Set-based writes: a handful of batched statements per 1000 rows instead of 3-5 round trips per row.
    await this.db.transaction(async (tx) => {
      const storeIds = new Map<string, string>();

      // stores (only a few per file)
      for (const r of rows) {
        const storeKey = r.retailer.toLowerCase();
        if (storeIds.has(storeKey)) continue;
        let storeId = resolveStore(r.retailer)?.id;
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
      }

      // sneakers: insert the new style codes (first row wins, as before), then load every id in one go
      const firstRowByCode = new Map<string, PriceRow>();
      for (const r of rows) if (!firstRowByCode.has(r.styleCode)) firstRowByCode.set(r.styleCode, r);
      const codes = [...firstRowByCode.keys()];
      const fresh = codes.filter((c) => !knownStyleCodes.has(c));
      for (const part of chunk(fresh, BATCH)) {
        await tx
          .insert(sneakers)
          .values(part.map((c) => {
            const r = firstRowByCode.get(c)!;
            return { brand: r.brand, model: r.model, colorway: r.colorway, styleCode: c };
          }))
          .onConflictDoNothing({ target: sneakers.styleCode });
      }
      const sneakerIds = new Map<string, string>();
      for (const part of chunk(codes, BATCH)) {
        const found = await tx.select({ id: sneakers.id, styleCode: sneakers.styleCode }).from(sneakers).where(inArray(sneakers.styleCode, part));
        for (const s of found) sneakerIds.set(s.styleCode, s.id);
      }

      // Real product photo from the store's listing (first row with an image), only where the shoe has none yet.
      const imageByCode = new Map<string, string>();
      for (const r of rows) if (r.imageUrl && !imageByCode.has(r.styleCode)) imageByCode.set(r.styleCode, r.imageUrl);
      for (const part of chunk([...imageByCode], BATCH)) {
        await tx.execute(sql`
          UPDATE sneakers s SET primary_image_url = v.url
          FROM (VALUES ${sql.join(part.map(([c, url]) => sql`(${sneakerIds.get(c)!}::uuid, ${url})`), sql`, `)}) AS v(id, url)
          WHERE s.id = v.id AND s.primary_image_url IS NULL
        `);
      }

      // size variants: size is numeric(4,1), so the DB returns "8.0" for "8"; key on the normalised value
      const variantKey = (sneakerId: string, size: string | number, system: string) => `${sneakerId}|${Number(size).toFixed(1)}|${system}`;
      const wanted = new Map<string, { sneakerId: string; size: string; sizeSystem: PriceRow['sizeSystem'] }>();
      for (const r of rows) {
        const sneakerId = sneakerIds.get(r.styleCode)!;
        wanted.set(variantKey(sneakerId, r.size, r.sizeSystem), { sneakerId, size: String(r.size), sizeSystem: r.sizeSystem });
      }
      const variantIds = new Map<string, string>();
      const loadVariants = async (ids: string[]) => {
        for (const part of chunk(ids, BATCH)) {
          const found = await tx
            .select({ id: sneakerVariants.id, sneakerId: sneakerVariants.sneakerId, size: sneakerVariants.size, sizeSystem: sneakerVariants.sizeSystem })
            .from(sneakerVariants)
            .where(and(inArray(sneakerVariants.sneakerId, part), eq(sneakerVariants.region, 'india')));
          for (const v of found) variantIds.set(variantKey(v.sneakerId, v.size, v.sizeSystem), v.id);
        }
      };
      const touchedSneakers = [...new Set([...wanted.values()].map((w) => w.sneakerId))];
      await loadVariants(touchedSneakers);
      const missing = [...wanted].filter(([k]) => !variantIds.has(k)).map(([, w]) => w);
      for (const part of chunk(missing, BATCH)) {
        const created = await tx
          .insert(sneakerVariants)
          .values(part.map((w) => ({ ...w, region: 'india' as const })))
          .onConflictDoNothing()
          .returning({ id: sneakerVariants.id });
        summary.newVariants += created.length;
      }
      if (missing.length > 0) await loadVariants([...new Set(missing.map((w) => w.sneakerId))]);

      // audit rows (append-only), batched
      const resolved = rows.map((r) => {
        const storeId = storeIds.get(r.retailer.toLowerCase())!;
        const variantId = variantIds.get(variantKey(sneakerIds.get(r.styleCode)!, r.size, r.sizeSystem));
        if (!variantId) throw new Error(`line ${r.line}: size variant was not created`);
        return { r, storeId, variantId };
      });
      for (const part of chunk(resolved, BATCH)) {
        await tx.insert(manualPriceEntries).values(part.map(({ r, storeId, variantId }) => ({
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
        })));
      }

      for (const { r, storeId, variantId } of resolved) {
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
    summary.pricesRecorded = await this.snapshots.recordMany(toSnapshot);
    summary.rowsImported = rows.length;

    // The Compare grid reads best price / signal from Market Intelligence (normally refreshed hourly):
    // recompute now so the new prices show up straight away. A failure here must not undo the import.
    try {
      if (opts.refresh !== false) await this.marketIntelligence.refreshAll();
    } catch (err) {
      this.logger.warn(`CSV import saved, but the market-intelligence refresh failed: ${(err as Error).message}`);
    }
    this.logger.log(
      `CSV import by ${opts.recordedBy}: ${summary.rowsImported} prices, ${summary.newSneakers} new sneakers, ${summary.newVariants} new sizes, ${newRetailers.length} new stores`,
    );
    return summary;
  }
}
