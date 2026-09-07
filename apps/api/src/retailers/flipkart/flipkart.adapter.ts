import { Injectable } from '@nestjs/common';
import { HttpRetailerAdapter } from '../http-retailer.adapter';
import { PermanentFetchError, type FetchTarget, type PriceType } from '../retailer-adapter.interface';

/**
 * Flipkart — the first adapter, chosen because Day 1 §04 rates it the
 * lowest-friction integration on the list: "standard signup, standard
 * terms," no lawyer review, and it's Tier 1 India-first, which matches
 * the region decision.
 *
 * CREDENTIALS: Flipkart's affiliate programme has been closed to new
 * registrations for some time, so there is no token to fetch with today.
 * Rather than block on an account that may never be granted, the adapter
 * is written against the documented affiliate-API response shape and
 * runs against fixtures when FLIPKART_AFFILIATE_TOKEN is unset — the
 * same no-op-until-configured convention Sentry, PostHog and Resend
 * follow here. `isConfigured` reports which mode it's in rather than
 * letting fixture data quietly masquerade as real prices.
 *
 * Day 7 note: originally this carried its own copies of the HTTP error
 * handling and normalize(). Both now live in HttpRetailerAdapter /
 * BaseRetailerAdapter so that all six adapters share one implementation
 * — the divergence the brief warns about is prevented structurally
 * rather than by remembering to copy carefully.
 */

/** The subset of Flipkart's affiliate product payload this adapter reads. */
interface FlipkartProductResponse {
  productBaseInfoV1?: {
    productId?: string;
    title?: string;
    flipkartSellingPrice?: { amount?: number; currency?: string };
    inStock?: boolean;
    productUrl?: string;
  };
  productShippingInfoV1?: { shippingCharges?: { amount?: number } };
}

const FIXTURES: Record<string, { price: number; shipping: number; inStock: boolean }> = {
  SHOFIXTURE001: { price: 8995, shipping: 0, inStock: true },
  SHOFIXTURE002: { price: 9195, shipping: 0, inStock: true },
  SHOFIXTURE003: { price: 9999, shipping: 99, inStock: true },
  SHOFIXTURE004: { price: 10499, shipping: 0, inStock: false },
  SHOFIXTURE005: { price: 12995, shipping: 149, inStock: true },
};

@Injectable()
export class FlipkartAdapter extends HttpRetailerAdapter {
  readonly slug = 'flipkart';
  readonly priceType: PriceType = 'retail';

  private readonly token = process.env.FLIPKART_AFFILIATE_TOKEN;
  private readonly affiliateId = process.env.FLIPKART_AFFILIATE_ID;

  get isConfigured(): boolean {
    return Boolean(this.token && this.affiliateId);
  }

  protected buildRequest(target: FetchTarget) {
    return {
      url:
        'https://affiliate-api.flipkart.net/affiliate/1.0/product.json?id=' +
        encodeURIComponent(target.retailerProductId!),
      headers: {
        'Fk-Affiliate-Id': this.affiliateId!,
        'Fk-Affiliate-Token': this.token!,
      },
    };
  }

  protected parse(payload: unknown, target: FetchTarget) {
    const base = (payload as FlipkartProductResponse).productBaseInfoV1;
    if (!base) {
      throw new PermanentFetchError('Flipkart payload had no productBaseInfoV1', {
        retailer: this.slug,
        styleCode: target.styleCode,
      });
    }

    return {
      price: base.flipkartSellingPrice?.amount ?? null,
      shippingCost:
        (payload as FlipkartProductResponse).productShippingInfoV1?.shippingCharges?.amount ?? null,
      currency: (base.flipkartSellingPrice?.currency ?? 'INR').toUpperCase(),
      inStock: base.inStock ?? false,
      listingUrl: base.productUrl ?? target.retailerProductUrl,
    };
  }

  protected fixture(target: FetchTarget): FlipkartProductResponse {
    const fixture = FIXTURES[target.retailerProductId!];
    if (!fixture) {
      throw new PermanentFetchError('No fixture for this product id', {
        retailer: this.slug,
        productId: target.retailerProductId,
        hint: 'Set FLIPKART_AFFILIATE_TOKEN/ID for live fetches, or seed a fixture.',
      });
    }

    // Deterministic per-size variation so ten variants don't all record an
    // identical price — enough to make the history and index work real
    // without pretending it's a live quote.
    return {
      productBaseInfoV1: {
        productId: target.retailerProductId!,
        title: `Fixture listing for ${target.styleCode}`,
        flipkartSellingPrice: {
          amount: fixture.price + Math.round((target.size - 8) * 100),
          currency: 'INR',
        },
        inStock: fixture.inStock,
        productUrl: target.retailerProductUrl,
      },
      productShippingInfoV1: { shippingCharges: { amount: fixture.shipping } },
    };
  }
}
