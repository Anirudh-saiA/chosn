import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../../db/drizzle.provider';
import { manualPriceEntries } from '../../db/schema';
import { BaseRetailerAdapter } from '../base-retailer.adapter';
import {
  PermanentFetchError,
  type FetchTarget,
  type PriceType,
  type RawRetailerOffer,
} from '../retailer-adapter.interface';

/**
 * Tier 2 boutiques — Superkicks, VegNonVeg — priced by hand.
 *
 * This is Day 1 §01's decision implemented literally: those sources are
 * "priced manually — deliberately, not as a fallback — to sidestep
 * scraping-compliance risk entirely for boutiques too small to justify a
 * partnership conversation." Day 7's brief asks for scrapers here; Day 1
 * ruled scraping out, dropping it from the integration_type enum
 * entirely. This adapter is what the spec actually calls for.
 *
 * It is also the only adapter in the set that works with no credentials
 * at all, because its source of truth is a table the team maintains.
 *
 * STALENESS IS A FAILURE, NOT A DEFAULT. A hand-entered price from two
 * months ago is worse than no price: CHOSN's entire proposition is that
 * the number on screen is current, and a stale one is confidently wrong.
 * So an entry past MAX_AGE_DAYS raises a PermanentFetchError rather than
 * being served. That routes it to the dead-letter queue and the health
 * summary, which turns "these boutiques need re-pricing" into a visible
 * worklist instead of silent rot — the monitoring built today doubles as
 * the reminder system for the manual process.
 */

/**
 * Day 1 §01 puts Tier 2 at "Weekly / event-triggered". Two weeks is that
 * cadence plus one missed cycle of grace, so a single skipped week
 * doesn't blank the listing.
 */
const MAX_AGE_DAYS = 14;

@Injectable()
export class ManualPriceAdapter extends BaseRetailerAdapter {
  /**
   * Not a real retailer slug. This adapter is selected by
   * integration_type = 'manual', so one implementation serves every
   * hand-priced source rather than needing a near-empty class each.
   */
  readonly slug = 'manual';
  readonly priceType: PriceType = 'retail';

  constructor(@Inject(DRIZZLE) private readonly db: Db) {
    super();
  }

  /** Always available — its data lives in our own database. */
  get isConfigured(): boolean {
    return true;
  }

  async fetchPrice(target: FetchTarget): Promise<RawRetailerOffer> {
    const [entry] = await this.db
      .select()
      .from(manualPriceEntries)
      .where(
        and(
          eq(manualPriceEntries.retailerId, target.retailerId),
          eq(manualPriceEntries.sneakerVariantId, target.sneakerVariantId),
        ),
      )
      .orderBy(desc(manualPriceEntries.recordedAt))
      .limit(1);

    if (!entry) {
      throw new PermanentFetchError('No manual price recorded for this variant', {
        retailer: this.slug,
        styleCode: target.styleCode,
        size: target.size,
        hint: 'Add a row to manual_price_entries for this retailer and variant.',
      });
    }

    const ageDays = (Date.now() - entry.recordedAt.getTime()) / 86_400_000;
    if (ageDays > MAX_AGE_DAYS) {
      throw new PermanentFetchError(
        `Manual price is ${Math.floor(ageDays)} days old (max ${MAX_AGE_DAYS}) — needs re-checking`,
        {
          retailer: this.slug,
          styleCode: target.styleCode,
          size: target.size,
          recordedAt: entry.recordedAt.toISOString(),
          recordedBy: entry.recordedBy,
        },
      );
    }

    return {
      retailerSlug: this.slug,
      price: entry.price === null ? null : Number(entry.price),
      shippingCost: entry.shippingCost === null ? null : Number(entry.shippingCost),
      currency: entry.currency.toUpperCase(),
      inStock: entry.inStock,
      condition: entry.condition,
      listingUrl: entry.listingUrl,
      // Boutiques stock deadstock retail; they don't run an authentication
      // programme the way StockX or GOAT do, so nothing is claimed here.
      authenticityVerified: false,
      fetchedAt: new Date(),
      raw: entry,
    };
  }
}
