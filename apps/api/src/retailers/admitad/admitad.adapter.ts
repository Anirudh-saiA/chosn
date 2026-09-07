import { Injectable } from '@nestjs/common';
import { HttpRetailerAdapter } from '../http-retailer.adapter';
import { PermanentFetchError, type FetchTarget, type PriceType } from '../retailer-adapter.interface';

/**
 * Myntra, via the Admitad affiliate network.
 *
 * Day 1 §01 lists Myntra as "Affiliate network (Admitad / vCommission)"
 * and §04 requires only a network application, no lawyer review.
 *
 * Admitad's product API returns a paginated `results` array even when
 * querying a single product, so the shape here is list-first — a detail
 * that would be easy to get wrong by assuming symmetry with Flipkart's
 * single-object response, and would fail at runtime rather than compile
 * time. Prices come as strings, not numbers, which is why parse() is
 * explicit about coercion instead of trusting the field's type.
 */

interface AdmitadProductResponse {
  results?: Array<{
    id?: string;
    name?: string;
    /** String, not number — Admitad serialises decimals as text. */
    price?: string;
    oldprice?: string;
    currency?: string;
    /** Admitad uses "available"/"not_available", not a boolean. */
    availability?: string;
    url?: string;
    delivery_cost?: string;
  }>;
}

const FIXTURES: Record<string, { price: number; delivery: number; available: boolean }> = {
  MYNFIXTURE001: { price: 8499, delivery: 0, available: true },
  MYNFIXTURE002: { price: 8799, delivery: 0, available: true },
  MYNFIXTURE003: { price: 9599, delivery: 0, available: true },
  MYNFIXTURE004: { price: 10199, delivery: 49, available: false },
  MYNFIXTURE005: { price: 12499, delivery: 0, available: true },
};

@Injectable()
export class AdmitadAdapter extends HttpRetailerAdapter {
  readonly slug = 'myntra';
  readonly priceType: PriceType = 'retail';

  private readonly token = process.env.ADMITAD_ACCESS_TOKEN;
  private readonly websiteId = process.env.ADMITAD_WEBSITE_ID;

  get isConfigured(): boolean {
    return Boolean(this.token && this.websiteId);
  }

  protected buildRequest(target: FetchTarget) {
    return {
      url:
        `https://api.admitad.com/products/?website=${this.websiteId}` +
        `&id=${encodeURIComponent(target.retailerProductId!)}`,
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
    };
  }

  protected parse(payload: unknown, target: FetchTarget) {
    const [product] = (payload as AdmitadProductResponse).results ?? [];
    if (!product) {
      // An empty results array means the product is gone from the feed,
      // not that the request failed — retrying returns the same emptiness.
      throw new PermanentFetchError('Admitad returned no results for this product id', {
        retailer: this.slug,
        styleCode: target.styleCode,
        productId: target.retailerProductId,
      });
    }

    return {
      price: this.toNumber(product.price),
      shippingCost: this.toNumber(product.delivery_cost),
      currency: (product.currency ?? 'INR').toUpperCase(),
      // Anything other than an explicit "available" is treated as out of
      // stock — see the Awin adapter for why we don't guess upward.
      inStock: product.availability?.trim().toLowerCase() === 'available',
      listingUrl: product.url ?? target.retailerProductUrl,
    };
  }

  /** "8499.00" -> 8499. Returns null for absent or unparseable values. */
  private toNumber(value: string | undefined): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  protected fixture(target: FetchTarget): AdmitadProductResponse {
    const fixture = FIXTURES[target.retailerProductId!];
    if (!fixture) {
      throw new PermanentFetchError('No fixture for this Admitad product id', {
        retailer: this.slug,
        productId: target.retailerProductId,
        hint: 'Set ADMITAD_ACCESS_TOKEN/ADMITAD_WEBSITE_ID for live fetches.',
      });
    }

    return {
      results: [
        {
          id: target.retailerProductId!,
          name: `Myntra fixture listing for ${target.styleCode}`,
          price: (fixture.price + (target.size - 8) * 100).toFixed(2),
          currency: 'INR',
          availability: fixture.available ? 'available' : 'not_available',
          delivery_cost: fixture.delivery.toFixed(2),
          url: target.retailerProductUrl,
        },
      ],
    };
  }
}
