import { BaseRetailerAdapter } from './base-retailer.adapter';
import {
  PermanentFetchError,
  TransientFetchError,
  type FetchTarget,
  type PriceType,
  type RawRetailerOffer,
} from './retailer-adapter.interface';

/**
 * Shared behaviour for every adapter that fetches over HTTP.
 *
 * Day 7's brief says to copy the Day 6 pattern exactly rather than
 * improvise per-adapter error handling. Copying it five times would
 * guarantee the opposite — the fifth copy drifts from the first the
 * moment anyone edits one. So the parts that must not vary (timeouts,
 * which status codes are retryable, the fail-closed checks in normalize)
 * live here once, and subclasses supply only what genuinely differs:
 * the URL, the auth headers, and how to read that retailer's payload.
 *
 * Anything a subclass overrides is a deliberate difference between
 * retailers. Anything it doesn't is guaranteed identical across all of
 * them, which is what the brief was actually asking for.
 */
export abstract class HttpRetailerAdapter extends BaseRetailerAdapter {
  abstract readonly slug: string;
  abstract readonly priceType: PriceType;
  abstract get isConfigured(): boolean;

  protected readonly timeoutMs: number = 10_000;

  /** The request to make for this variant. */
  protected abstract buildRequest(target: FetchTarget): { url: string; headers: Record<string, string> };

  /**
   * Pulls price/stock/URL out of this retailer's payload shape. Throws
   * PermanentFetchError if the payload can't be read — a shape change is
   * not something a retry fixes.
   */
  protected abstract parse(
    payload: unknown,
    target: FetchTarget,
  ): Pick<RawRetailerOffer, 'price' | 'shippingCost' | 'currency' | 'inStock' | 'listingUrl'>;

  /** Deterministic stand-in used until credentials exist. */
  protected abstract fixture(target: FetchTarget): unknown;

  async fetchPrice(target: FetchTarget): Promise<RawRetailerOffer> {
    if (!target.retailerProductId) {
      throw new PermanentFetchError(`No ${this.slug} product id mapped for this sneaker`, {
        retailer: this.slug,
        styleCode: target.styleCode,
        size: target.size,
      });
    }

    const payload = this.isConfigured ? await this.request(target) : this.fixture(target);
    const parsed = this.parse(payload, target);

    return {
      retailerSlug: this.slug,
      ...parsed,
      condition: this.condition,
      authenticityVerified: this.authenticityVerified,
      fetchedAt: new Date(),
      raw: payload,
    };
  }

  private async request(target: FetchTarget): Promise<unknown> {
    const { url, headers } = this.buildRequest(target);

    let res: Response;
    try {
      res = await fetch(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      // Timeouts, DNS and socket failures are the textbook retryable case.
      throw new TransientFetchError(`${this.slug} request failed: ${(err as Error).message}`, {
        retailer: this.slug,
        styleCode: target.styleCode,
        productId: target.retailerProductId,
      });
    }

    if (res.status === 404) {
      throw new PermanentFetchError(`${this.slug} returned 404 — mapping is stale`, {
        retailer: this.slug,
        styleCode: target.styleCode,
        productId: target.retailerProductId,
      });
    }

    // 429 and 5xx are worth retrying. Other 4xx mean the request itself is
    // wrong, and sending it again unchanged just repeats the mistake.
    if (res.status === 429 || res.status >= 500) {
      throw new TransientFetchError(`${this.slug} returned ${res.status}`, {
        retailer: this.slug,
        styleCode: target.styleCode,
        status: res.status,
      });
    }
    if (!res.ok) {
      throw new PermanentFetchError(`${this.slug} returned ${res.status}`, {
        retailer: this.slug,
        styleCode: target.styleCode,
        status: res.status,
      });
    }

    try {
      return await res.json();
    } catch {
      throw new PermanentFetchError(`${this.slug} returned unparseable JSON`, {
        retailer: this.slug,
        styleCode: target.styleCode,
      });
    }
  }
}
