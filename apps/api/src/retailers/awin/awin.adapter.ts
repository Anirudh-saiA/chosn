import { Injectable } from '@nestjs/common';
import { HttpRetailerAdapter } from '../http-retailer.adapter';
import { PermanentFetchError, type FetchTarget, type PriceType } from '../retailer-adapter.interface';

/**
 * END. Clothing, via the Awin affiliate network.
 *
 * Day 1 §04: "Established network, clear terms", no lawyer review needed
 * — which is why this is the first of today's batch.
 *
 * TWO NORMALIZATION TRAPS this source has and Flipkart doesn't, both
 * called out in the Day 7 brief:
 *
 * 1. CURRENCY. END. is a UK retailer that ships to India. Awin reports
 *    in the publisher account's configured currency, commonly GBP, not
 *    INR. We store what the retailer actually quoted and convert at
 *    render — Day 1 Assumption 02 is explicit that prices are not
 *    pre-converted in the database, because a stored conversion silently
 *    goes stale and there is then no way to tell what was really quoted.
 *
 * 2. SHIPPING. Awin's product feed carries delivery cost as a separate
 *    field, and for an India-bound order from the UK it is a large
 *    fraction of the total. Folding it into `price` would make END. look
 *    cheaper than it is and corrupt "best price" comparisons. It goes in
 *    shipping_cost, separately, as the schema intends.
 */

interface AwinProductResponse {
  product?: {
    productId?: string;
    productName?: string;
    price?: { amount?: number; currency?: string };
    deliveryCost?: { amount?: number };
    /** Awin's stock vocabulary is a string, not a boolean. */
    stockStatus?: string;
    inStock?: number | boolean;
    awDeepLink?: string;
    merchantDeepLink?: string;
  };
}

const FIXTURES: Record<string, { price: number; delivery: number; stock: string }> = {
  ENDFIXTURE001: { price: 95.0, delivery: 12.5, stock: 'in stock' },
  ENDFIXTURE002: { price: 105.0, delivery: 12.5, stock: 'in stock' },
  ENDFIXTURE003: { price: 120.0, delivery: 12.5, stock: 'out of stock' },
  ENDFIXTURE004: { price: 110.0, delivery: 12.5, stock: 'in stock' },
  ENDFIXTURE005: { price: 135.0, delivery: 15.0, stock: 'in stock' },
};

@Injectable()
export class AwinAdapter extends HttpRetailerAdapter {
  readonly slug = 'end-clothing';
  readonly priceType: PriceType = 'retail';

  private readonly token = process.env.AWIN_API_TOKEN;
  private readonly publisherId = process.env.AWIN_PUBLISHER_ID;

  get isConfigured(): boolean {
    return Boolean(this.token && this.publisherId);
  }

  protected buildRequest(target: FetchTarget) {
    return {
      url:
        `https://api.awin.com/publishers/${this.publisherId}/products/` +
        `${encodeURIComponent(target.retailerProductId!)}`,
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
    };
  }

  protected parse(payload: unknown, target: FetchTarget) {
    const product = (payload as AwinProductResponse).product;
    if (!product) {
      throw new PermanentFetchError('Awin payload had no product object', {
        retailer: this.slug,
        styleCode: target.styleCode,
      });
    }

    return {
      price: product.price?.amount ?? null,
      // Kept separate, never folded into price — see the header note.
      shippingCost: product.deliveryCost?.amount ?? null,
      // GBP for a UK merchant. Stored as quoted; converted at render.
      currency: (product.price?.currency ?? 'GBP').toUpperCase(),
      inStock: this.readStock(product),
      listingUrl: product.awDeepLink ?? product.merchantDeepLink ?? target.retailerProductUrl,
    };
  }

  /**
   * Awin reports stock as free text ("in stock", "Out of Stock") on some
   * feeds and as 0/1 on others. Anything unrecognised is treated as out
   * of stock rather than guessed as available — claiming something is
   * buyable when it isn't sends the user to a dead end.
   */
  private readStock(product: NonNullable<AwinProductResponse['product']>): boolean {
    if (typeof product.inStock === 'boolean') return product.inStock;
    if (typeof product.inStock === 'number') return product.inStock > 0;

    const status = product.stockStatus?.trim().toLowerCase();
    if (!status) return false;
    return status === 'in stock' || status === 'instock' || status === 'available';
  }

  protected fixture(target: FetchTarget): AwinProductResponse {
    const fixture = FIXTURES[target.retailerProductId!];
    if (!fixture) {
      throw new PermanentFetchError('No fixture for this Awin product id', {
        retailer: this.slug,
        productId: target.retailerProductId,
        hint: 'Set AWIN_API_TOKEN/AWIN_PUBLISHER_ID for live fetches.',
      });
    }

    return {
      product: {
        productId: target.retailerProductId!,
        productName: `END. fixture listing for ${target.styleCode}`,
        price: { amount: fixture.price + (target.size - 8) * 2.5, currency: 'GBP' },
        deliveryCost: { amount: fixture.delivery },
        stockStatus: fixture.stock,
        awDeepLink: target.retailerProductUrl,
      },
    };
  }
}
