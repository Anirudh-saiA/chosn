import { Logger } from '@nestjs/common';
import {
  PermanentFetchError,
  type Condition,
  type FetchTarget,
  type PriceSnapshotInput,
  type PriceType,
  type RawRetailerOffer,
  type RetailerAdapter,
} from './retailer-adapter.interface';

/**
 * What every adapter shares regardless of where its data comes from.
 *
 * normalize() lives here rather than in the HTTP base because manually
 * priced sources need exactly the same guarantees: Day 1 §01 prices
 * Tier 2 boutiques by hand *deliberately*, not as a fallback, so a
 * hand-entered price has to clear the same bar as a fetched one. If
 * these checks lived only on the HTTP path, the manual sources would be
 * the ones quietly allowed to store a broken row.
 */
export abstract class BaseRetailerAdapter implements RetailerAdapter {
  abstract readonly slug: string;
  abstract readonly priceType: PriceType;
  abstract get isConfigured(): boolean;
  abstract fetchPrice(target: FetchTarget): Promise<RawRetailerOffer>;

  protected readonly logger = new Logger(this.constructor.name);

  /** Resale sources authenticate; retail has nothing to claim. */
  protected readonly authenticityVerified: boolean = false;
  protected readonly condition: Condition = 'new';

  /**
   * Identical for every retailer, and deliberately so — this is where
   * "fail closed, not silently wrong" is enforced, and it would be the
   * worst possible place for adapters to differ by accident.
   */
  normalize(offer: RawRetailerOffer, target: FetchTarget): PriceSnapshotInput {
    // An in-stock listing with no price is a broken payload. Storing it as
    // zero or null would quietly poison every average and buy/wait signal
    // computed downstream. Out of stock with no price is just the truth.
    if (offer.inStock && (offer.price === null || offer.price <= 0)) {
      throw new PermanentFetchError('In-stock listing reported no usable price', {
        retailer: this.slug,
        styleCode: target.styleCode,
        size: target.size,
        price: offer.price,
      });
    }
    if (!offer.listingUrl) {
      throw new PermanentFetchError('Offer has no listing URL — View Deal would go nowhere', {
        retailer: this.slug,
        styleCode: target.styleCode,
      });
    }
    if (!/^[A-Z]{3}$/.test(offer.currency)) {
      throw new PermanentFetchError(`Unexpected currency code: ${offer.currency}`, {
        retailer: this.slug,
        styleCode: target.styleCode,
      });
    }

    return {
      sneakerVariantId: target.sneakerVariantId,
      retailerId: target.retailerId,
      // NUMERIC in, string out — going via JS floats would round money.
      price: (offer.price ?? 0).toFixed(2),
      shippingCost: offer.shippingCost === null ? null : offer.shippingCost.toFixed(2),
      currency: offer.currency,
      condition: offer.condition,
      priceType: this.priceType,
      inStock: offer.inStock,
      listingUrl: offer.listingUrl,
      authenticityVerified: offer.authenticityVerified,
      fetchedAt: offer.fetchedAt,
    };
  }
}
