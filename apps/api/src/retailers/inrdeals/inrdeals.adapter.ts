import { Injectable } from '@nestjs/common';
import { HttpRetailerAdapter } from '../http-retailer.adapter';
import { PermanentFetchError, type FetchTarget, type PriceType } from '../retailer-adapter.interface';

/**
 * Ajio / Ajio Luxe, via INRDeals.
 *
 * Day 1 §01 routes Ajio through an Indian affiliate aggregator; §04
 * requires only a network application.
 *
 * PRICING TRAP specific to Indian marketplace feeds: they commonly quote
 * both an MRP and a discounted selling price, and it is the selling price
 * a shopper actually pays. Reading the wrong field would make Ajio look
 * systematically more expensive and quietly lose it every price
 * comparison it should win. We take the offer price and fall back to MRP
 * only when no offer price exists.
 *
 * SHIPPING: Indian marketplace listings are typically delivered free
 * above a threshold, and the feed reports 0 rather than omitting the
 * field. Zero is a real, meaningful value here — distinct from "unknown",
 * which is null.
 */

interface InrdealsProductResponse {
  status?: string;
  data?: {
    product_id?: string;
    title?: string;
    /** Discounted price actually charged. */
    offer_price?: number | string;
    /** Undiscounted list price. */
    mrp?: number | string;
    currency?: string;
    /** "Y"/"N" — Indian feeds commonly use single-character flags. */
    in_stock?: string | boolean;
    shipping_charge?: number | string;
    deeplink?: string;
    product_url?: string;
  };
}

const FIXTURES: Record<string, { mrp: number; offer: number; shipping: number; stock: string }> = {
  AJIOFIXTURE001: { mrp: 9999, offer: 8249, shipping: 0, stock: 'Y' },
  AJIOFIXTURE002: { mrp: 10499, offer: 8899, shipping: 0, stock: 'Y' },
  AJIOFIXTURE003: { mrp: 11999, offer: 9749, shipping: 0, stock: 'Y' },
  AJIOFIXTURE004: { mrp: 12499, offer: 10999, shipping: 99, stock: 'N' },
  AJIOFIXTURE005: { mrp: 14999, offer: 12749, shipping: 0, stock: 'Y' },
};

@Injectable()
export class InrdealsAdapter extends HttpRetailerAdapter {
  readonly slug = 'ajio';
  readonly priceType: PriceType = 'retail';

  private readonly token = process.env.INRDEALS_API_TOKEN;
  private readonly publisherId = process.env.INRDEALS_PUBLISHER_ID;

  get isConfigured(): boolean {
    return Boolean(this.token && this.publisherId);
  }

  protected buildRequest(target: FetchTarget) {
    return {
      url:
        `https://inrdeals.com/api/v1/product?id=${encodeURIComponent(target.retailerProductId!)}` +
        `&pub=${this.publisherId}`,
      headers: { 'X-Api-Token': this.token!, Accept: 'application/json' },
    };
  }

  protected parse(payload: unknown, target: FetchTarget) {
    const body = payload as InrdealsProductResponse;
    if (body.status && body.status.toLowerCase() !== 'success') {
      throw new PermanentFetchError(`INRDeals reported status "${body.status}"`, {
        retailer: this.slug,
        styleCode: target.styleCode,
      });
    }

    const data = body.data;
    if (!data) {
      throw new PermanentFetchError('INRDeals payload had no data object', {
        retailer: this.slug,
        styleCode: target.styleCode,
      });
    }

    // Offer price first — that's what the shopper pays. MRP is the
    // fallback only when there's no discount on the listing.
    const price = this.toNumber(data.offer_price) ?? this.toNumber(data.mrp);

    return {
      price,
      shippingCost: this.toNumber(data.shipping_charge),
      currency: (data.currency ?? 'INR').toUpperCase(),
      inStock: this.readStock(data.in_stock),
      listingUrl: data.deeplink ?? data.product_url ?? target.retailerProductUrl,
    };
  }

  private toNumber(value: number | string | undefined): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /** "Y"/"N" flags, with boolean tolerated in case the feed changes. */
  private readStock(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') return value;
    const flag = value?.trim().toUpperCase();
    return flag === 'Y' || flag === 'YES' || flag === 'TRUE';
  }

  protected fixture(target: FetchTarget): InrdealsProductResponse {
    const fixture = FIXTURES[target.retailerProductId!];
    if (!fixture) {
      throw new PermanentFetchError('No fixture for this INRDeals product id', {
        retailer: this.slug,
        productId: target.retailerProductId,
        hint: 'Set INRDEALS_API_TOKEN/INRDEALS_PUBLISHER_ID for live fetches.',
      });
    }

    const bump = (target.size - 8) * 100;
    return {
      status: 'success',
      data: {
        product_id: target.retailerProductId!,
        title: `Ajio fixture listing for ${target.styleCode}`,
        mrp: fixture.mrp + bump,
        offer_price: fixture.offer + bump,
        currency: 'INR',
        in_stock: fixture.stock,
        shipping_charge: fixture.shipping,
        deeplink: target.retailerProductUrl,
      },
    };
  }
}
