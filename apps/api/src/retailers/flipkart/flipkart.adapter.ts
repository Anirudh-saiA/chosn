import { Injectable, Logger } from '@nestjs/common';
import {
  PermanentFetchError,
  TransientFetchError,
  type FetchTarget,
  type PriceSnapshotInput,
  type PriceType,
  type RawRetailerOffer,
  type RetailerAdapter,
} from '../retailer-adapter.interface';

/**
 * Flipkart — the first adapter, chosen because Day 1 §04 rates it the
 * lowest-friction integration on the list: "standard signup, standard
 * terms," no lawyer review, and it's Tier 1 India-first, which matches
 * the region decision.
 *
 * CREDENTIALS: Flipkart's affiliate programme has been closed to new
 * registrations for some time, so there is no token to fetch with today.
 * Rather than block Day 6 on an account that may never be granted, the
 * adapter is written against the documented affiliate-API response shape
 * and runs against fixtures when FLIPKART_AFFILIATE_TOKEN is unset —
 * the same no-op-until-configured convention Sentry, PostHog and Resend
 * already follow here. Setting the token switches it to live HTTP with
 * no other change, and `isConfigured` reports which mode it's in rather
 * than letting fixture data quietly masquerade as real prices.
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
export class FlipkartAdapter implements RetailerAdapter {
  readonly slug = 'flipkart';
  readonly priceType: PriceType = 'retail';

  private readonly logger = new Logger(FlipkartAdapter.name);
  private readonly token = process.env.FLIPKART_AFFILIATE_TOKEN;
  private readonly affiliateId = process.env.FLIPKART_AFFILIATE_ID;

  get isConfigured(): boolean {
    return Boolean(this.token && this.affiliateId);
  }

  async fetchPrice(target: FetchTarget): Promise<RawRetailerOffer> {
    if (!target.retailerProductId) {
      // An unmapped product is a data problem, not a network one — no
      // amount of retrying produces a mapping.
      throw new PermanentFetchError('No Flipkart product id mapped for this sneaker', {
        styleCode: target.styleCode,
        size: target.size,
      });
    }

    const payload = this.isConfigured
      ? await this.fetchLive(target)
      : this.fetchFixture(target);

    return this.toOffer(payload, target);
  }

  private async fetchLive(target: FetchTarget): Promise<FlipkartProductResponse> {
    const url = `https://affiliate-api.flipkart.net/affiliate/1.0/product.json?id=${encodeURIComponent(
      target.retailerProductId!,
    )}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'Fk-Affiliate-Id': this.affiliateId!,
          'Fk-Affiliate-Token': this.token!,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      // Timeouts and DNS/socket failures are the textbook retryable case.
      throw new TransientFetchError(`Flipkart request failed: ${(err as Error).message}`, {
        styleCode: target.styleCode,
        productId: target.retailerProductId,
      });
    }

    if (res.status === 404) {
      throw new PermanentFetchError('Flipkart returned 404 — mapping is stale', {
        styleCode: target.styleCode,
        productId: target.retailerProductId,
      });
    }

    // 429 and 5xx are worth retrying; other 4xx mean the request itself
    // is wrong, and sending it again unchanged just repeats the mistake.
    if (res.status === 429 || res.status >= 500) {
      throw new TransientFetchError(`Flipkart returned ${res.status}`, {
        styleCode: target.styleCode,
        status: res.status,
      });
    }
    if (!res.ok) {
      throw new PermanentFetchError(`Flipkart returned ${res.status}`, {
        styleCode: target.styleCode,
        status: res.status,
      });
    }

    try {
      return (await res.json()) as FlipkartProductResponse;
    } catch {
      throw new PermanentFetchError('Flipkart returned unparseable JSON', {
        styleCode: target.styleCode,
      });
    }
  }

  private fetchFixture(target: FetchTarget): FlipkartProductResponse {
    const fixture = FIXTURES[target.retailerProductId!];
    if (!fixture) {
      throw new PermanentFetchError('No fixture for this product id', {
        productId: target.retailerProductId,
        hint: 'Set FLIPKART_AFFILIATE_TOKEN/ID for live fetches, or seed a fixture.',
      });
    }

    // Deterministic per-size variation so ten variants don't all record
    // an identical price — enough to make the history/index work real
    // without pretending it's a live quote.
    const sizeAdjustment = Math.round((target.size - 8) * 100);

    return {
      productBaseInfoV1: {
        productId: target.retailerProductId!,
        title: `Fixture listing for ${target.styleCode}`,
        flipkartSellingPrice: { amount: fixture.price + sizeAdjustment, currency: 'INR' },
        inStock: fixture.inStock,
        productUrl: target.retailerProductUrl,
      },
      productShippingInfoV1: { shippingCharges: { amount: fixture.shipping } },
    };
  }

  private toOffer(payload: FlipkartProductResponse, target: FetchTarget): RawRetailerOffer {
    const base = payload.productBaseInfoV1;
    if (!base) {
      throw new PermanentFetchError('Flipkart payload had no productBaseInfoV1', {
        styleCode: target.styleCode,
      });
    }

    return {
      retailerSlug: this.slug,
      price: base.flipkartSellingPrice?.amount ?? null,
      shippingCost: payload.productShippingInfoV1?.shippingCharges?.amount ?? null,
      currency: base.flipkartSellingPrice?.currency ?? 'INR',
      inStock: base.inStock ?? false,
      condition: 'new', // Flipkart is retail; there is no used listing here
      listingUrl: base.productUrl ?? target.retailerProductUrl,
      // Retail doesn't need to claim authentication — that's a resale
      // concern (StockX/GOAT/Culture Circle), per Day 1 §02.
      authenticityVerified: false,
      fetchedAt: new Date(),
      raw: payload,
    };
  }

  normalize(offer: RawRetailerOffer, target: FetchTarget): PriceSnapshotInput {
    // Fail closed. An in-stock listing with no price is a broken payload,
    // and writing it as a null/zero price would quietly corrupt every
    // average and buy/wait signal computed downstream. Out of stock with
    // no price, on the other hand, is just the truth.
    if (offer.inStock && (offer.price === null || offer.price <= 0)) {
      throw new PermanentFetchError('In-stock listing reported no usable price', {
        styleCode: target.styleCode,
        size: target.size,
        price: offer.price,
      });
    }
    if (!offer.listingUrl) {
      throw new PermanentFetchError('Offer has no listing URL — View Deal would go nowhere', {
        styleCode: target.styleCode,
      });
    }
    if (!/^[A-Z]{3}$/.test(offer.currency)) {
      throw new PermanentFetchError(`Unexpected currency code: ${offer.currency}`, {
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
