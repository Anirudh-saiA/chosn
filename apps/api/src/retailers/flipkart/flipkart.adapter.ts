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
  // Day 28 catalog expansion — see drizzle/0015_day28_catalog_expansion.sql
  // and scripts/generate-catalog-expansion.ts for how these mappings were
  // confirmed (mapping-assist tool suggestion + human review).
  SHOFIXTURE006: { price: 11499, shipping: 0, inStock: true }, // Jordan 1 Chicago Lost & Found
  SHOFIXTURE007: { price: 8999, shipping: 99, inStock: true }, // Air Max 90 Infrared
  SHOFIXTURE008: { price: 13999, shipping: 0, inStock: false }, // Yeezy Boost 350 V2 Zebra — discontinued at retail, listing shown out of stock
  SHOFIXTURE009: { price: 11199, shipping: 149, inStock: true }, // NB 990v5 Grey
  SHOFIXTURE010: { price: 5499, shipping: 0, inStock: true }, // Chuck 70 Hi Black
  SHOFIXTURE011: { price: 12199, shipping: 0, inStock: true }, // Air Max 97 Silver Bullet
  SHOFIXTURE012: { price: 6399, shipping: 0, inStock: true }, // Gazelle Core Black
  SHOFIXTURE013: { price: 6699, shipping: 99, inStock: true }, // Blazer Mid 77 Vintage
  SHOFIXTURE014: { price: 12199, shipping: 0, inStock: true }, // Jordan 4 Black Cat
  SHOFIXTURE015: { price: 4499, shipping: 0, inStock: true }, // Vans Old Skool
  SHOFIXTURE016: { price: 5099, shipping: 0, inStock: true }, // Puma Suede Classic
  SHOFIXTURE017: { price: 9599, shipping: 149, inStock: true }, // NB 2002R Protection Pack
  SHOFIXTURE018: { price: 6999, shipping: 0, inStock: true }, // Dunk Low Grey Fog
  SHOFIXTURE019: { price: 12199, shipping: 0, inStock: true }, // Jordan 4 White Cement
  SHOFIXTURE020: { price: 8999, shipping: 0, inStock: true }, // Air Max 1 Anniversary Red
  SHOFIXTURE021: { price: 9599, shipping: 99, inStock: true }, // ASICS Gel-Kayano 14
  SHOFIXTURE022: { price: 7399, shipping: 0, inStock: true }, // Dunk High Panda
  SHOFIXTURE023: { price: 4199, shipping: 0, inStock: true }, // Vans Sk8-Hi
  SHOFIXTURE024: { price: 6999, shipping: 0, inStock: true }, // Samba OG Core Black
  SHOFIXTURE025: { price: 12199, shipping: 149, inStock: true }, // Ultraboost Light Core Black
  SHOFIXTURE026: { price: 6999, shipping: 0, inStock: true }, // NB 550 White/Grey
  SHOFIXTURE027: { price: 6399, shipping: 0, inStock: true }, // Chuck 70 Hi Parchment
  SHOFIXTURE028: { price: 7399, shipping: 0, inStock: true }, // Air Force 1 '07 LV8
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
