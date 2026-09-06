/**
 * The contract every retailer adapter implements. Ten of these get built
 * (Day 1 §01's v1 list), so the shape is settled here once rather than
 * renegotiated per source.
 *
 * Two rules the shape enforces, both learned from what the Day 1 source
 * list actually contains:
 *
 * 1. fetch and normalize are separate steps. Sources range from a real
 *    affiliate API (Flipkart) through network feeds (Awin, Admitad) to
 *    manually-priced boutiques — wildly different payloads, but all of
 *    them have to land in the same PriceSnapshot shape. Keeping the raw
 *    payload intact through fetch means a normalization bug is
 *    debuggable after the fact instead of being lost at the boundary.
 *
 * 2. Errors are typed by whether retrying could plausibly help. The
 *    queue's backoff policy reads that distinction rather than guessing
 *    from a message string: hammering a retailer that returned "no such
 *    product" three more times is just rudeness with extra steps.
 */

export type SizeSystem = 'us' | 'uk' | 'eu' | 'cm';
export type Condition = 'new' | 'used';
export type PriceType = 'retail' | 'resale' | 'auction';

/** One variant at one retailer — everything an adapter needs to fetch. */
export interface FetchTarget {
  /** Canonical join key (Day 1 §03), e.g. "DD1391-100". */
  styleCode: string;
  size: number;
  sizeSystem: SizeSystem;
  /** The retailer's own product id, from retailer_product_mappings. */
  retailerProductId: string | null;
  retailerProductUrl: string;
  /** Foreign keys, so normalize() can produce an insertable row. */
  sneakerVariantId: string;
  retailerId: string;
}

/**
 * What the retailer said, kept as close to verbatim as the transport
 * allows. `raw` is the untouched payload — it exists so a bad snapshot
 * can be traced back to what actually arrived.
 */
export interface RawRetailerOffer {
  retailerSlug: string;
  price: number | null;
  shippingCost: number | null;
  /** ISO 4217, as the retailer reported it — never pre-converted. */
  currency: string;
  inStock: boolean;
  condition: Condition;
  /** Deep link to this exact size — what "View Deal" opens. */
  listingUrl: string;
  authenticityVerified: boolean;
  fetchedAt: Date;
  raw: unknown;
}

/** A row ready for insertion into price_snapshots. */
export interface PriceSnapshotInput {
  sneakerVariantId: string;
  retailerId: string;
  price: string;
  shippingCost: string | null;
  currency: string;
  condition: Condition;
  priceType: PriceType;
  inStock: boolean;
  listingUrl: string;
  authenticityVerified: boolean;
  fetchedAt: Date;
}

/**
 * Something went wrong that a retry might fix — a timeout, a 5xx, a rate
 * limit. The queue retries these with backoff.
 */
export class TransientFetchError extends Error {
  readonly retryable = true as const;
  constructor(
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'TransientFetchError';
  }
}

/**
 * Something is wrong that retrying cannot fix — an unmapped product, a
 * malformed payload, a 404. These go straight to the dead-letter queue
 * so a broken mapping surfaces as an alert instead of burning retries.
 */
export class PermanentFetchError extends Error {
  readonly retryable = false as const;
  constructor(
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PermanentFetchError';
  }
}

export interface RetailerAdapter {
  /** Matches retailers.slug — how a queue finds its adapter. */
  readonly slug: string;

  /** Retail vs resale changes how the buy/wait signal weighs a price. */
  readonly priceType: PriceType;

  /**
   * False when credentials are missing. The worker reports this rather
   * than treating an unconfigured source as a failure — matching how
   * Sentry, PostHog and Resend already behave in this codebase.
   */
  readonly isConfigured: boolean;

  /** Throws TransientFetchError / PermanentFetchError; never returns partial data. */
  fetchPrice(target: FetchTarget): Promise<RawRetailerOffer>;

  /**
   * Pure — no I/O, so it's testable against a captured payload. Throws
   * PermanentFetchError if the offer can't produce a complete row, which
   * is what keeps a partial write out of price_snapshots.
   */
  normalize(offer: RawRetailerOffer, target: FetchTarget): PriceSnapshotInput;
}
