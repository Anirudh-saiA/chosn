import { scoreOutlook, type PriceOutlook } from './price-outlook';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { COLOR_FAMILIES, colorRegex, normalizeQuery, parseList } from './catalog-filters';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import {
  MarketIntelligenceService,
  type MarketIntelligenceSummary,
  type Signal,
} from '../pricing/market-intelligence.service';
import { BUDGET_LIMITS, clampBudgetParams, toBudgetItem, type BudgetItem } from './budget';
import { retailerModeFor, type RetailerMode } from '../retailers/retailer-mode';

/** One offer a store runs. kind: sale | coupon | bank | card | wallet | emi | shipping | credit | info. See scripts/offers/curated_offers.json. */
export interface StoreOffer {
  kind: string;
  text: string;
  code?: string;
  bank?: string;
  upTo?: number;
  conditions?: string;
  url?: string;
  source?: string;
  seenAt?: string;
}

/** A group of ways to pay (UPI, cards, wallets ...) exactly as the store shows them. */
export interface PaymentGroup {
  kind: string;
  label: string;
  items: string[];
  note?: string;
  unavailable?: boolean;
  source?: string;
  seenAt?: string;
}

export interface CatalogOffer {
  retailerSlug: string;
  retailerName: string;
  retailerLogoUrl: string | null;
  price: number;
  shippingCost: number;
  currency: string;
  /** null when the currency has no fx_rates row — see effective_price_inr(). */
  effectivePriceInr: number | null;
  condition: string;
  inStock: boolean;
  listingUrl: string;
  /** This retailer's own listing photo — the fallback tier in the frontend's image resolution (lib/resolve-sneaker-image.ts). Null far more often than not today; see price_snapshots.image_url's own comment. */
  imageUrl: string | null;
  fetchedAt: string;
  fetchFrequencyMinutes: number;
  /** The store's own published delivery estimate in days (null = not known). See drizzle/0019. */
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  deliveryNote: string | null;
  deliverySourceUrl: string | null;
  /** Store rating, only ever set from a citable source (null = no review data found). */
  rating: number | null;
  reviewCount: number | null;
  ratingSource: string | null;
  ratingUrl: string | null;
  /** The store's Trust score (0-100), how much evidence is behind it, and the working (see scripts/trust). Null until computed. */
  trustScore: number | null;
  trustConfidence: 'high' | 'medium' | 'low' | null;
  trustDetail: { parts: Record<string, number>; why: string[]; sources: Array<{ title: string; url: string }>; formula: string; computed: string } | null;
  /** Payment methods the store says it accepts (empty = the store doesn't say, so none are shown). */
  paymentMethods: string[];
  shippingNote: string | null;
  returnsNote: string | null;
  /** 'ok' | 'limited' | 'none' — how friendly the return rule is. */
  returnsTone: string | null;
  infoSourceUrl: string | null;
  /** Live offers read from the store's own site, plus the ones checked by hand. */
  offers: StoreOffer[];
  /** Every way to pay, grouped. Empty = the store does not say. */
  paymentOptions: PaymentGroup[];
  offersUpdatedAt: string | null;
  /** Older than 2x the retailer's own cadence — same rule Day 9's ranking uses. */
  isStale: boolean;
  /**
   * 'fixture' means this retailer's credentials were never approved and
   * the price/URL are placeholder data, not a real quote (Day 20: this
   * was previously invisible on the price page — only /health/fetch
   * exposed it — so a fixture price rendered identically to a real one).
   */
  mode: RetailerMode;
}

export interface CatalogVariant {
  id: string;
  size: number;
  sizeSystem: string;
  region: string;
}

export interface CatalogSneaker {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  silhouette: string | null;
  gender: string;
  /** The canonical, curated photo — top of the resolution priority (lib/resolve-sneaker-image.ts). Missing from this endpoint's query until now; search/drops already select it, the price comparison page never did. */
  primaryImageUrl: string | null;
  /** Extra photos of the same pair from other angles (sneakers.gallery_image_refs). Empty when only the primary photo is known. */
  galleryImageUrls: string[];
}

export interface SiblingSize {
  size: number;
  sizeSystem: string;
  /** True when at least one connected store has this size in stock right now. */
  available: boolean;
}

export interface CatalogResponse {
  sneaker: CatalogSneaker;
  variant: CatalogVariant;
  siblingSizes: SiblingSize[];
  /** Every store CHOSN reads prices from, so the page can show the ones that do not have this size (a grey crossed button). */
  connectedStores: Array<{ slug: string; name: string; logoUrl: string | null }>;
  offers: CatalogOffer[];
  marketIntelligence: MarketIntelligenceSummary | null;
  /** Buy now / Wait outlook for this shoe in this size (price-outlook.ts). */
  outlook: PriceOutlook | null;
}

/** node-postgres hands numeric[] back as the text "{3,3.5}" unless a type parser is registered. */
function parsePgArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.replace(/^\{|\}$/g, '').split(',').filter((v) => v !== '');
}

/** One day of recorded prices for a shoe in one size (real listings only, shipping included). */
export interface PriceHistoryPoint {
  /** Calendar day in India, YYYY-MM-DD. */
  day: string;
  bestPrice: number;
  bestStore: string;
  stores: Array<{ slug: string; name: string; price: number }>;
}

export interface PriceHistory {
  points: PriceHistoryPoint[];
  /** First day any price was recorded (null when none yet). */
  since: string | null;
}

/** One shoe in the side-by-side compare view: its cheapest in-stock price at every store that lists it. */
export interface CompareItem {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  /** Cheapest in-stock price (shipping included) across stores, null when nothing is in stock. */
  bestPrice: number | null;
  bestRetailerName: string | null;
  /** UK sizes that at least one store has in stock. */
  sizesInStock: number[];
  /** A size to deep-link into the full price page (the cheapest listing's size). */
  linkSize: number | null;
  offers: Array<{
    retailerSlug: string;
    retailerName: string;
    bestPrice: number;
    listingUrl: string;
    sizesInStock: number[];
  }>;
}

export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'stores' | 'outlook' | 'newest';

export interface SearchParams {
  q?: string;
  /** Comma-separated brand names. */
  brand?: string;
  /** Comma-separated retailer slugs: shoes in stock at any of them. */
  store?: string;
  /** Comma-separated colour families (see catalog-filters.ts). */
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Only shoes in stock at this many stores or more (compare across sites). */
  minStores?: number;
  /** UK size: only shoes in stock in this size; price, stores and the card's size are for this size. */
  size?: number;
  includeSoldOut?: boolean;
  sort?: SearchSort;
  signal?: string;
  /** Only shoes whose Buy now / Wait verdict (for the shown size) is this. */
  outlook?: string;
  /** Only shoes a store first listed in the last N days (listing_first_seen, baseline rows excluded). */
  newDays?: number;
  limit?: number;
  offset?: number;
  /** Internal: match ANY typed word instead of all of them (second attempt when nothing matched). */
  relaxed?: boolean;
  /** Internal: tolerate typos by similarity (third attempt; needs the pg_trgm extension). */
  fuzzy?: boolean;
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface SearchFacets {
  brands: FacetOption[];
  stores: Array<{ slug: string; name: string; count: number }>;
  colors: FacetOption[];
  /** Cheapest-price range of the matching shoes (p98 trims outliers for a slider's upper end). */
  price: { min: number; max: number; p98: number };
}

/** One colourway of a model, as offered in the colour picker (the cheapest in-stock size is where it links to). */
export interface ColourOption {
  styleCode: string;
  colorway: string;
  primaryImageUrl: string | null;
  defaultSize: number;
  /** UK sizes this colourway has in stock (empty when it is sold out). */
  sizesInStock: number[];
  bestAvailablePrice: number | null;
  /** True for the shoe the page / card is about. */
  current: boolean;
}

/** One store's price for a colour's default size, for the card's "Compare prices" row. */
export interface ColourOffer {
  slug: string;
  price: number;
  inStock: boolean;
  /** The store's own "was" price for this listing, when it shows one above the price. */
  wasPrice: number | null;
}

export interface SearchResultItem {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  silhouette: string | null;
  primaryImageUrl: string | null;
  /** The variant a card's "click through" navigates to — see search()'s doc comment. */
  defaultSize: number;
  defaultSizeSystem: string;
  currentPrice: number | null;
  bestAvailablePrice: number | null;
  signal: Signal | null;
  /** Buy now / Wait / Fair price for the size the card shows; null when there is not enough evidence to call it (search results only). */
  outlook?: 'buy_now' | 'wait' | 'fair' | 'unclear' | null;
  currency: string;
  /** How many real stores have this shoe in stock (search results only). */
  storeCount?: number;
  /** Search results: every colourway of this model that matched, the shown one first (a card = one model). */
  colours?: Array<Pick<ColourOption, 'styleCode' | 'colorway' | 'primaryImageUrl' | 'defaultSize' | 'bestAvailablePrice'> & { sizes?: number[]; storeSlugs?: string[]; sizeList?: Array<{ size: number; available: boolean }>; offers?: ColourOffer[] }>;
  /** Only on /similar: true when this is the same model in another colourway. */
  sameModel?: boolean;
  /** Only on /similar: the cheapest in-stock store for this shoe and its direct listing link. */
  bestRetailerName?: string;
  listingUrl?: string;
}

export interface CommunityPostSearchResult {
  id: string;
  postType: string;
  title: string | null;
  /** Truncated — a search result is a pointer to the post, not the post itself. */
  preview: string;
  authorDisplayName: string | null;
  createdAt: string;
}

export interface SearchResponse {
  results: SearchResultItem[];
  /** Name and logo of every live store, so a card can show the logos of the stores that have the shoe. */
  storeDirectory: Array<{ slug: string; name: string; logoUrl: string | null }>;
  total: number;
  /** Every brand in the catalog, unfiltered — populates the filter UI regardless of the current query. */
  brands: string[];
  /** Filter options with counts for the current text query (brands, stores, colours, price range). */
  facets: SearchFacets;
  /**
   * Day 24 task 1 — the same search box now also surfaces matching
   * community discussion, clearly separate from `results` so the page
   * can label and render the two groups distinctly rather than mixing a
   * price-comparison card and a forum post into one undifferentiated
   * grid. Empty whenever there's no text query — browsing by brand/signal
   * alone has no obvious community equivalent to show alongside it.
   */
  communityPosts: CommunityPostSearchResult[];
}

interface VariantRow {
  style_code: string;
  brand: string;
  model: string;
  colorway: string;
  silhouette: string | null;
  gender: string;
  primary_image_url: string | null;
  gallery_image_refs: string[] | null;
  variant_id: string;
  size: string;
  size_system: string;
  region: string;
  sneaker_id: string;
}

interface OfferRow {
  retailer_slug: string;
  retailer_name: string;
  retailer_logo_url: string | null;
  fetch_frequency_minutes: number;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  delivery_note: string | null;
  delivery_source_url: string | null;
  rating: string | null;
  review_count: number | null;
  rating_source: string | null;
  rating_url: string | null;
  trust_score: number | null;
  trust_confidence: string | null;
  trust_detail: Record<string, unknown> | null;
  payment_methods: string[] | string | null;
  shipping_note: string | null;
  returns_note: string | null;
  returns_tone: string | null;
  info_source_url: string | null;
  offers: StoreOffer[] | null;
  payment_options: PaymentGroup[] | null;
  offers_updated_at: string | null;
  integration_type: string;
  price: string;
  shipping_cost: string | null;
  currency: string;
  condition: string;
  in_stock: boolean;
  listing_url: string;
  image_url: string | null;
  fetched_at: string;
  effective_price_inr: string | null;
}

/**
 * The one read the price comparison page needs: a variant, its sibling
 * sizes, every retailer's current listing (not just the winner — the
 * page shows stale/out-of-stock rows too, which Day 9's ranking query
 * deliberately excludes), and the precomputed Market Intelligence
 * summary. A single round trip from the Next.js server component.
 *
 * The offer list is a live, indexed read (is_latest = true, ≤10 rows) —
 * not the aggregation Day 9's "no live computation" rule is about. That
 * rule covers avg_30d/avg_90d/trend/signal specifically, which this
 * still reads only from market_summaries via MarketIntelligenceService.
 */
@Injectable()
export class CatalogService {
  private readonly searchCache = new Map<string, { at: number; value: SearchResponse }>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly intelligence: MarketIntelligenceService,
  ) {}

  async getVariantPage(styleCode: string, size: number): Promise<CatalogResponse> {
    const { rows } = await this.db.execute(sql`
      SELECT s.id AS sneaker_id, s.style_code, s.brand, s.model, s.colorway, s.silhouette, s.gender,
             s.primary_image_url, s.gallery_image_refs,
             v.id AS variant_id, v.size, v.size_system, v.region
      FROM sneakers s
      JOIN sneaker_variants v ON v.sneaker_id = s.id
      WHERE s.style_code = ${styleCode} AND v.size = ${size}::numeric
      LIMIT 1
    `);
    const variantRow = rows[0] as unknown as VariantRow | undefined;
    if (!variantRow) {
      throw new NotFoundException(`No variant for style_code "${styleCode}" size ${size}`);
    }

    const [siblings, offers, marketIntelligence, stores] = await Promise.all([
      this.siblingSizes(variantRow.sneaker_id),
      this.offersFor(variantRow.variant_id),
      this.intelligence.getCached(variantRow.variant_id),
      this.storeSummary(),
    ]);

    return {
      sneaker: {
        styleCode: variantRow.style_code,
        brand: variantRow.brand,
        model: variantRow.model,
        colorway: variantRow.colorway,
        silhouette: variantRow.silhouette,
        gender: variantRow.gender,
        primaryImageUrl: variantRow.primary_image_url,
        galleryImageUrls: variantRow.gallery_image_refs ?? [],
      },
      variant: {
        id: variantRow.variant_id,
        size: Number(variantRow.size),
        sizeSystem: variantRow.size_system,
        region: variantRow.region,
      },
      siblingSizes: siblings,
      connectedStores: stores.stores.map((s) => ({ slug: s.slug, name: s.name, logoUrl: s.logoUrl })),
      offers,
      marketIntelligence,
      outlook: await this.outlookFor(variantRow, offers, siblings).catch(() => null),
    };
  }

  /** Gathers what the outlook model reads for one shoe in one size, then scores it. Never throws into the page (the caller swallows errors). */
  private async outlookFor(v: VariantRow, offers: CatalogOffer[], siblings: SiblingSize[]): Promise<PriceOutlook> {
    const live = offers.filter((o) => o.inStock && o.effectivePriceInr !== null && !o.listingUrl.includes('FIXTURE'));
    const storePrices = live.map((o) => Number(o.effectivePriceInr));
    const best = storePrices.length ? Math.min(...storePrices) : null;
    const [{ rows: hist }, { rows: was }] = await Promise.all([
      this.db.execute(sql`SELECT d.day::text AS day, d.best_price_inr::float AS price, r.name AS store FROM daily_best_prices d LEFT JOIN retailers r ON r.id = d.best_retailer_id WHERE d.sneaker_variant_id = ${v.variant_id} AND d.day >= current_date - 90 ORDER BY d.day`),
      this.db.execute(sql`
        SELECT ps.compare_at_price::float AS was FROM price_snapshots ps
        WHERE ps.sneaker_variant_id = ${v.variant_id} AND ps.is_latest AND ps.in_stock AND ps.compare_at_price IS NOT NULL AND ps.listing_url NOT LIKE '%FIXTURE%'
        ORDER BY effective_price_inr(ps.price, ps.shipping_cost, ps.currency) ASC LIMIT 1`),
    ]);
    const band = best === null ? null : best < 3000 ? 'under3k' : best < 6000 ? '3-6k' : best < 10000 ? '6-10k' : best < 20000 ? '10-20k' : '20k+';
    let peer: { n: number; dropShare: number; windowDays: number } | null = null;
    if (band) {
      const { rows } = await this.db.execute(sql`
        SELECT n, drop_share, window_days FROM price_outlook_priors
        WHERE (brand = ${v.brand} AND band = ${band}) OR (brand = '*' AND band = ${band}) OR (brand = '*' AND band = '*')
        ORDER BY (brand = ${v.brand}) DESC, (band = ${band}) DESC LIMIT 1`).catch(() => ({ rows: [] }));
      const r = rows[0] as { n: number; drop_share: number; window_days: number } | undefined;
      if (r) peer = { n: Number(r.n), dropShare: Number(r.drop_share), windowDays: Number(r.window_days) };
    }
    return scoreOutlook({
      bestPrice: best,
      storePrices,
      wasPrice: (was[0] as { was: number } | undefined)?.was ?? null,
      history: (hist as unknown as Array<{ day: string; price: number; store: string | null }>).map((h) => ({ day: h.day, price: Number(h.price), store: h.store })),
      storesInStock: new Set(live.map((o) => o.retailerSlug)).size,
      sizesInStock: siblings.filter((x) => x.available).length,
      sizesKnown: siblings.length,
      peer,
      today: new Date(),
    });
  }

  private async siblingSizes(sneakerId: string): Promise<SiblingSize[]> {
    const { rows } = await this.db.execute(sql`
      SELECT v.size, v.size_system,
             EXISTS (SELECT 1 FROM price_snapshots ps
                     WHERE ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.in_stock = true
                       AND ps.listing_url NOT LIKE '%FIXTURE%') AS available
      FROM sneaker_variants v
      WHERE v.sneaker_id = ${sneakerId}
      ORDER BY v.size ASC
    `);
    return (rows as unknown as { size: string; size_system: string; available: boolean }[]).map((r) => ({
      size: Number(r.size),
      sizeSystem: r.size_system,
      available: r.available,
    }));
  }

  private async offersFor(variantId: string): Promise<CatalogOffer[]> {
    const { rows } = await this.db.execute(sql`
      SELECT r.slug AS retailer_slug, r.name AS retailer_name, r.logo_url AS retailer_logo_url,
             r.fetch_frequency_minutes, r.integration_type::text AS integration_type,
             r.delivery_min_days, r.delivery_max_days, r.delivery_note, r.delivery_source_url,
             COALESCE(rp.rating, r.rating) AS rating, COALESCE(rp.rating_count, r.review_count) AS review_count,
             CASE WHEN rp.rating IS NOT NULL THEN r.name ELSE r.rating_source END AS rating_source,
             COALESCE(rp.source_url, r.rating_url) AS rating_url,
             r.trust_score, r.trust_confidence, r.trust_detail,
             r.payment_methods, r.shipping_note, r.returns_note, r.returns_tone, r.info_source_url, r.offers, r.payment_options, r.offers_updated_at,
             ps.price, ps.shipping_cost, ps.currency, ps.condition, ps.in_stock,
             ps.listing_url, ps.image_url, ps.fetched_at,
             effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS effective_price_inr
      FROM price_snapshots ps
      JOIN retailers r ON r.id = ps.retailer_id
      LEFT JOIN sneaker_variants sv ON sv.id = ps.sneaker_variant_id
      LEFT JOIN retailer_product_ratings rp ON rp.sneaker_id = sv.sneaker_id AND rp.retailer_id = ps.retailer_id
      WHERE ps.sneaker_variant_id = ${variantId} AND ps.is_latest = true
      ORDER BY effective_price_inr(ps.price, ps.shipping_cost, ps.currency) ASC NULLS LAST
    `);

    return (rows as unknown as OfferRow[]).map((r) => {
      const fetchedAt = new Date(r.fetched_at);
      const staleCutoffMs = r.fetch_frequency_minutes * 2 * 60_000;
      return {
        retailerSlug: r.retailer_slug,
        retailerName: r.retailer_name,
        retailerLogoUrl: r.retailer_logo_url,
        price: Number(r.price),
        shippingCost: Number(r.shipping_cost ?? 0),
        currency: r.currency,
        effectivePriceInr: r.effective_price_inr !== null ? Number(r.effective_price_inr) : null,
        condition: r.condition,
        inStock: r.in_stock,
        listingUrl: r.listing_url,
        imageUrl: r.image_url,
        fetchedAt: fetchedAt.toISOString(),
        fetchFrequencyMinutes: r.fetch_frequency_minutes,
        deliveryMinDays: r.delivery_min_days,
        deliveryMaxDays: r.delivery_max_days,
        deliveryNote: r.delivery_note,
        deliverySourceUrl: r.delivery_source_url,
        rating: r.rating !== null ? Number(r.rating) : null,
        reviewCount: r.review_count,
        ratingSource: r.rating_source,
        ratingUrl: r.rating_url,
        trustScore: r.trust_score ?? null,
        trustConfidence: (r.trust_confidence as 'high' | 'medium' | 'low' | null) ?? null,
        trustDetail: (r.trust_detail as CatalogOffer['trustDetail']) ?? null,
        paymentMethods: parsePgArray(r.payment_methods),
        shippingNote: r.shipping_note,
        returnsNote: r.returns_note,
        returnsTone: r.returns_tone,
        infoSourceUrl: r.info_source_url,
        offers: Array.isArray(r.offers) ? r.offers : [],
        paymentOptions: Array.isArray(r.payment_options) ? r.payment_options : [],
        offersUpdatedAt: r.offers_updated_at ? new Date(r.offers_updated_at).toISOString() : null,
        isStale: Date.now() - fetchedAt.getTime() > staleCutoffMs,
        mode: retailerModeFor(r.retailer_slug, r.integration_type),
      };
    });
  }

  /**
   * Search + browse (Day 11 task 1-3). One indexed query, not one per
   * card: joins sneakers -> its lowest-size variant -> that variant's
   * precomputed market_summaries row, so a whole grid's worth of prices
   * comes back in a single round trip rather than N Redis/Postgres
   * reads for N cards — still no live aggregation (market_summaries is
   * exactly the precomputed table Day 9 built for this), just read
   * efficiently rather than one-card-at-a-time.
   *
   * "Default size" = each sneaker's cheapest in-stock size (its smallest
   * size when none has a price yet). There's no real popularity signal to
   * rank by, so the card shows what you can actually buy for the least.
   *
   * Filtering is a SQL WHERE clause (brand, signal, full-text query),
   * never a client-side filter of the whole catalog — task 3.
   */
  /** Same filters within 30 seconds return the same answer: the per-store summary behind them is the slow part. */
  /**
   * For the card's bottom half: every size of each colour with whether any store has it in stock, the stores that have anything in stock,
   * and each store's price for the colour's default size (the one the card opens on).
   */
  async cardStock(
    codes: string[],
    pairs: ReadonlyArray<readonly [string, number]>,
  ): Promise<Map<string, { sizes: number[]; slugs: string[]; sizeList: Array<{ size: number; available: boolean }>; offers: ColourOffer[] }>> {
    const perColour = new Map<string, { sizes: number[]; slugs: string[]; sizeList: Array<{ size: number; available: boolean }>; offers: ColourOffer[] }>();
    if (codes.length === 0) return perColour;
    const codeList = sql`ARRAY[${sql.join(codes.map((c) => sql`${c}`), sql`, `)}]::text[]`;
    const { rows: sizeRows } = await this.db.execute(sql`
      SELECT s.style_code, v.size,
             COALESCE(bool_or(ps.in_stock), false) AS available,
             to_json(array_agg(DISTINCT r.slug) FILTER (WHERE ps.in_stock)) AS slugs
      FROM sneakers s
      JOIN sneaker_variants v ON v.sneaker_id = s.id
      LEFT JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.listing_url NOT LIKE '%FIXTURE%'
      LEFT JOIN retailers r ON r.id = ps.retailer_id
      WHERE s.style_code = ANY(${codeList})
      GROUP BY s.style_code, v.size
      ORDER BY s.style_code, v.size
    `);
    for (const r of sizeRows as unknown as { style_code: string; size: string; available: boolean; slugs: string[] | null }[]) {
      const e = perColour.get(r.style_code) ?? { sizes: [], slugs: [], sizeList: [], offers: [] };
      const size = Number(r.size);
      e.sizeList.push({ size, available: r.available });
      if (r.available) e.sizes.push(size);
      for (const slug of r.slugs ?? []) if (!e.slugs.includes(slug)) e.slugs.push(slug);
      perColour.set(r.style_code, e);
    }
    if (pairs.length > 0) {
      const { rows: offerRows } = await this.db.execute(sql`
        SELECT s.style_code, r.slug, ps.in_stock, ps.compare_at_price,
               effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price
        FROM (VALUES ${sql.join(pairs.map(([c, z]) => sql`(${c}, ${z}::numeric)`), sql`, `)}) AS want(code, size)
        JOIN sneakers s ON s.style_code = want.code
        JOIN sneaker_variants v ON v.sneaker_id = s.id AND v.size = want.size
        JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.listing_url NOT LIKE '%FIXTURE%'
        JOIN retailers r ON r.id = ps.retailer_id
        ORDER BY s.style_code, effective_price_inr(ps.price, ps.shipping_cost, ps.currency) ASC NULLS LAST
      `);
      for (const r of offerRows as unknown as { style_code: string; slug: string; in_stock: boolean; compare_at_price: string | null; price: string | null }[]) {
        if (r.price === null) continue;
        const e = perColour.get(r.style_code);
        const was = r.compare_at_price !== null ? Math.round(Number(r.compare_at_price)) : null;
        e?.offers.push({ slug: r.slug, price: Math.round(Number(r.price)), inStock: r.in_stock, wasPrice: was !== null && was > Number(r.price) ? was : null });
      }
    }
    return perColour;
  }

  /**
   * What shoppers did on this shoe in the last `days` days: how many views, and how many chose each store (clicked Buy). Counts only; no
   * one is identified. Repeat visitors are counted where a visitor agreed to analytics.
   */
  async choices(styleCode: string, days: number): Promise<{ days: number; views: number; visitors: number; repeatVisitors: number; clicks: Record<string, number> }> {
    const { rows } = await this.db.execute(sql`
      SELECT event, retailer_slug, count(*) AS n, count(DISTINCT visitor_id) AS visitors
      FROM offer_events
      WHERE style_code = ${styleCode} AND created_at > now() - make_interval(days => ${days})
      GROUP BY event, retailer_slug
    `);
    const { rows: rep } = await this.db.execute(sql`
      SELECT count(*) AS n FROM (
        SELECT visitor_id FROM offer_events
        WHERE style_code = ${styleCode} AND visitor_id IS NOT NULL AND created_at > now() - make_interval(days => ${days})
        GROUP BY visitor_id HAVING count(DISTINCT created_at::date) > 1
      ) t
    `);
    let views = 0;
    let visitors = 0;
    const clicks: Record<string, number> = {};
    for (const r of rows as Array<{ event: string; retailer_slug: string | null; n: string; visitors: string }>) {
      if (r.event === 'view') {
        views += Number(r.n);
        visitors += Number(r.visitors);
      } else if (r.retailer_slug) {
        clicks[r.retailer_slug] = Number(r.n);
      }
    }
    return { days, views, visitors, repeatVisitors: Number((rep[0] as { n: string } | undefined)?.n ?? 0), clicks };
  }

  /** One colour's card data, for a card that switches to a colour it was not sent: its default size is its cheapest in-stock one. */
  async cardData(styleCode: string): Promise<{ defaultSize: number | null; sizeList: Array<{ size: number; available: boolean }>; offers: ColourOffer[]; storeSlugs: string[] }> {
    const { rows } = await this.db.execute(sql`
      SELECT COALESCE(st.min_size, dv.size) AS size
      FROM sneakers s
      LEFT JOIN catalog_stats_mv st ON st.sneaker_id = s.id
      LEFT JOIN catalog_default_variant_mv dv ON dv.sneaker_id = s.id
      WHERE s.style_code = ${styleCode} LIMIT 1
    `);
    const size = (rows[0] as { size: string } | undefined)?.size;
    const map = await this.cardStock([styleCode], size ? [[styleCode, Number(size)] as const] : []);
    const e = map.get(styleCode);
    return { defaultSize: size ? Number(size) : null, sizeList: e?.sizeList ?? [], offers: e?.offers ?? [], storeSlugs: e?.slugs ?? [] };
  }

  /** The photos of one shoe (main photo first, then the other angles), fetched when a card's photo buttons are used. */
  async photos(styleCode: string): Promise<{ photos: string[] }> {
    const { rows } = await this.db.execute(sql`
      SELECT primary_image_url, gallery_image_refs FROM sneakers WHERE style_code = ${styleCode} LIMIT 1
    `);
    const r = rows[0] as { primary_image_url: string | null; gallery_image_refs: string[] | null } | undefined;
    if (!r) return { photos: [] };
    return { photos: [...new Set([r.primary_image_url, ...(r.gallery_image_refs ?? [])].filter((u): u is string => Boolean(u)))].slice(0, 6) };
  }

  private discountsCache = new Map<string, { at: number; value: StoreDiscount[] }>();

  /**
   * Biggest discounts by the store's own "was" price (its compare-at price, saved with each listing). It is the store's claim about
   * its original price, shown as such. One entry per shoe: its biggest discount. Only in-stock listings, a believable "was" price
   * (at least 15% above the price and no more than 4 times it), and no tiny prices, so junk entries do not show.
   */
  async discounts(limit = 24, minPct = 20): Promise<StoreDiscount[]> {
    const key = `${limit}|${minPct}`;
    const hit = this.discountsCache.get(key);
    if (hit && Date.now() - hit.at < 600_000) return hit.value;
    const { rows } = await this.db.execute(sql`
      WITH d AS (
        SELECT DISTINCT ON (s.id) s.style_code, s.brand, s.model, s.colorway, s.primary_image_url, v.size,
               ps.compare_at_price AS was, ps.price AS now_price, r.name AS store,
               round(((ps.compare_at_price - ps.price) / ps.compare_at_price * 100)::numeric, 1) AS pct
        FROM price_snapshots ps
        JOIN retailers r ON r.id = ps.retailer_id
        JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
        JOIN sneakers s ON s.id = v.sneaker_id
        WHERE ps.is_latest = true AND ps.in_stock = true AND ps.compare_at_price IS NOT NULL
          AND ps.listing_url NOT LIKE '%FIXTURE%'
          AND ps.price >= 500
          AND ps.compare_at_price >= ps.price * 1.15 AND ps.compare_at_price <= ps.price * 2 -- up to 50% off: beyond that a "was" price is rarely believable
          AND (ps.compare_at_price - ps.price) / ps.compare_at_price * 100 >= ${minPct}::numeric
        ORDER BY s.id, pct DESC
      )
      -- Balanced across stores: each store's best few come first (so one store cannot fill the list), then the rest by size of discount.
      SELECT * FROM (SELECT d.*, row_number() OVER (PARTITION BY store ORDER BY pct DESC) AS store_rank FROM d) x
      ORDER BY (store_rank > ${Math.max(2, Math.ceil(limit / 3))}), pct DESC, brand, model LIMIT ${limit}
    `);
    const value = (rows as Array<Record<string, unknown>>).map((r) => ({
      styleCode: String(r.style_code),
      brand: String(r.brand),
      model: String(r.model),
      colorway: String(r.colorway),
      primaryImageUrl: (r.primary_image_url as string | null) ?? null,
      size: Number(r.size),
      wasPrice: Math.round(Number(r.was)),
      price: Math.round(Number(r.now_price)),
      discountPct: Number(r.pct),
      store: String(r.store),
    }));
    this.discountsCache.set(key, { at: Date.now(), value });
    return value;
  }

  private budgetCache = new Map<string, { at: number; value: BudgetItem[] }>();

  /**
   * The budget shelf: for each shoe, its cheapest eligible offer at or under `max` rupees, cheapest shoes first, with the offers that store runs.
   * Eligible = the price page's own rules: latest snapshot, in stock, not placeholder data (a FIXTURE listing), not stale (fetched within twice the
   * store's own cadence), and a known rupee price (price plus shipping, via effective_price_inr). Prices under Rs 500 are ignored as junk, as in discounts().
   * Offers are the store's own, with their source and date; none are made up.
   */
  async budget(maxIn?: number, limitIn?: number): Promise<BudgetItem[]> {
    const { max, limit } = clampBudgetParams(maxIn, limitIn);
    const key = `${max}|${limit}`;
    const hit = this.budgetCache.get(key);
    if (hit && Date.now() - hit.at < 300_000) return hit.value;
    const { rows } = await this.db.execute(sql`
      SELECT * FROM (
        SELECT DISTINCT ON (s.id) s.style_code, s.brand, s.model, s.colorway, s.primary_image_url, v.size,
               r.slug, r.name AS store_name, r.offers, r.offers_updated_at,
               ps.shipping_cost, ps.listing_url, ps.fetched_at,
               effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS eff
        FROM price_snapshots ps
        JOIN retailers r ON r.id = ps.retailer_id
        JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
        JOIN sneakers s ON s.id = v.sneaker_id
        WHERE ps.is_latest = true AND ps.in_stock = true
          AND ps.listing_url NOT LIKE '%FIXTURE%'
          AND ps.fetched_at >= now() - (r.fetch_frequency_minutes * 2) * interval '1 minute'
          AND ps.price >= ${BUDGET_LIMITS.minMax}
          AND effective_price_inr(ps.price, ps.shipping_cost, ps.currency) IS NOT NULL
          AND effective_price_inr(ps.price, ps.shipping_cost, ps.currency) <= ${max}
        ORDER BY s.id, effective_price_inr(ps.price, ps.shipping_cost, ps.currency) ASC, ps.fetched_at DESC
      ) cheapest
      ORDER BY eff ASC, brand, model, style_code
      LIMIT ${limit}
    `);
    const value = (rows as Array<Record<string, unknown>>).map(toBudgetItem);
    this.budgetCache.set(key, { at: Date.now(), value });
    return value;
  }

  private dropsCache = new Map<string, { at: number; value: PriceDrop[] }>();

  /**
   * "Crazy falls": shoes where the store with the cheapest in-stock price cut it by at least `minPct` since the last day we recorded
   * before the newest one (a cheaper store merely appearing does not count), one entry per shoe (its biggest fall across sizes). Read from daily_best_prices, which holds each size's cheapest price per day, so a fall
   * is a real recorded one. The newest recorded day must be no older than yesterday, and tiny or absurd prices are ignored.
   */
  async priceDrops(limit = 24, minPct = 15): Promise<PriceDrop[]> {
    const key = `${limit}|${minPct}`;
    const hit = this.dropsCache.get(key);
    if (hit && Date.now() - hit.at < 600_000) return hit.value;
    const { rows } = await this.db.execute(sql`
      WITH r AS (
        SELECT sneaker_variant_id, day, best_price_inr, best_retailer_id,
               row_number() OVER (PARTITION BY sneaker_variant_id ORDER BY day DESC) AS rn
        FROM daily_best_prices WHERE day >= CURRENT_DATE - 7
      ),
      c AS (SELECT * FROM r WHERE rn = 1 AND day >= CURRENT_DATE - 1),
      p AS (SELECT * FROM r WHERE rn = 2),
      d AS (
        SELECT DISTINCT ON (s.id) s.style_code, s.brand, s.model, s.colorway, s.primary_image_url, v.size,
               p.best_price_inr AS prev_price, c.best_price_inr AS cur_price, p.day AS prev_day, c.day AS cur_day, rt.name AS store,
               round(((p.best_price_inr - c.best_price_inr) / p.best_price_inr * 100)::numeric, 1) AS pct
        FROM c JOIN p USING (sneaker_variant_id)
        JOIN sneaker_variants v ON v.id = c.sneaker_variant_id
        JOIN sneakers s ON s.id = v.sneaker_id
        JOIN retailers rt ON rt.id = c.best_retailer_id
        WHERE c.best_retailer_id = p.best_retailer_id -- the same store cut its price (not a cheaper store showing up)
          AND c.best_price_inr < p.best_price_inr * (1 - ${minPct}::numeric / 100)
          AND c.best_price_inr > p.best_price_inr * 0.5 -- a fall of more than half in a day is far more likely a data slip than a real cut
          AND c.best_price_inr >= 300 AND p.best_price_inr >= 500
        ORDER BY s.id, pct DESC
      )
      -- Balanced across stores, as in discounts(): each store's best few first, then the rest.
      SELECT * FROM (SELECT d.*, row_number() OVER (PARTITION BY store ORDER BY pct DESC) AS store_rank FROM d) x
      ORDER BY (store_rank > ${Math.max(2, Math.ceil(limit / 3))}), pct DESC, brand, model LIMIT ${limit}
    `);
    const value = (rows as Array<Record<string, unknown>>).map((r) => ({
      styleCode: String(r.style_code),
      brand: String(r.brand),
      model: String(r.model),
      colorway: String(r.colorway),
      primaryImageUrl: (r.primary_image_url as string | null) ?? null,
      size: Number(r.size),
      previousPrice: Math.round(Number(r.prev_price)),
      currentPrice: Math.round(Number(r.cur_price)),
      dropPct: Number(r.pct),
      store: String(r.store),
      previousDay: new Date(r.prev_day as string).toISOString().slice(0, 10),
      currentDay: new Date(r.cur_day as string).toISOString().slice(0, 10),
    }));
    this.dropsCache.set(key, { at: Date.now(), value });
    return value;
  }

  private storeSummaryCache: { at: number; value: StoreSummary } | null = null;

  /**
   * Every live store with the number of shoes and brands it has in stock right now (demo fixtures left out), its share of
   * the catalogue, and when its prices were last read. Feeds the public "Stores we compare" page. Cached for 10 minutes.
   */
  async storeSummary(): Promise<StoreSummary> {
    if (this.storeSummaryCache && Date.now() - this.storeSummaryCache.at < 600_000) return this.storeSummaryCache.value;
    const { rows } = await this.db.execute(sql`
      SELECT r.slug, r.name, r.base_url, r.logo_url, r.delivery_min_days, r.delivery_max_days,
             count(DISTINCT s.id) AS shoes, count(DISTINCT s.brand) AS brands, max(ps.fetched_at) AS last_updated
      FROM retailers r
      JOIN price_snapshots ps ON ps.retailer_id = r.id AND ps.is_latest = true AND ps.in_stock = true AND ps.listing_url NOT LIKE '%FIXTURE%'
      JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
      JOIN sneakers s ON s.id = v.sneaker_id
      WHERE r.status = 'active'
      GROUP BY r.id
      ORDER BY shoes DESC
    `);
    const { rows: totals } = await this.db.execute(sql`
      SELECT count(DISTINCT s.id) AS shoes, count(DISTINCT s.brand) AS brands
      FROM catalog_stats_mv st JOIN sneakers s ON s.id = st.sneaker_id
    `);
    const t = (totals[0] ?? {}) as { shoes?: string | number; brands?: string | number };
    const totalShoes = Number(t.shoes ?? 0);
    const value: StoreSummary = {
      totalShoes,
      totalBrands: Number(t.brands ?? 0),
      stores: (rows as Array<Record<string, unknown>>).map((r) => ({
        slug: String(r.slug),
        name: String(r.name),
        baseUrl: (r.base_url as string | null) ?? null,
        logoUrl: (r.logo_url as string | null) ?? null,
        shoes: Number(r.shoes),
        brands: Number(r.brands),
        sharePct: totalShoes > 0 ? Math.round((Number(r.shoes) / totalShoes) * 1000) / 10 : 0,
        lastUpdated: r.last_updated ? new Date(r.last_updated as string).toISOString() : null,
        deliveryMinDays: r.delivery_min_days === null ? null : Number(r.delivery_min_days),
        deliveryMaxDays: r.delivery_max_days === null ? null : Number(r.delivery_max_days),
      })),
    };
    this.storeSummaryCache = { at: Date.now(), value };
    return value;
  }

  async search(input: SearchParams): Promise<SearchResponse> {
    const params = input.q ? { ...input, q: normalizeQuery(input.q) } : input;
    const key = JSON.stringify(params);
    const hit = this.searchCache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.value;
    let value = await this.runSearch(params);
    // Nothing matched every word: try any word, then (if the database supports it) tolerate typos.
    if (value.total === 0 && params.q && !params.offset) {
      // The exact shoe may exist but be sold out everywhere: show it (marked sold out) rather than unrelated ones.
      if (!params.includeSoldOut) {
        const withSoldOut = await this.runSearch({ ...params, includeSoldOut: true });
        if (withSoldOut.total > 0) {
          this.searchCache.set(key, { at: Date.now(), value: withSoldOut });
          return withSoldOut;
        }
      }
      const relaxed = await this.runSearch({ ...params, relaxed: true });
      if (relaxed.total > 0) value = relaxed;
      else if (await this.canFuzzy()) {
        const fuzzy = await this.runSearch({ ...params, fuzzy: true });
        if (fuzzy.total > 0) value = fuzzy;
      }
    }
    if (this.searchCache.size >= 200) this.searchCache.clear();
    this.searchCache.set(key, { at: Date.now(), value });
    return value;
  }

  private trgm: Promise<boolean> | null = null;

  /** pg_trgm powers typo-tolerant matching; enable it on first need, and quietly go without if that isn't allowed. */
  private canFuzzy(): Promise<boolean> {
    this.trgm ??= this.db
      .execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
      .then(() => true)
      .catch(() => false);
    return this.trgm;
  }

  private async runSearch(params: SearchParams): Promise<SearchResponse> {
    const limit = Math.min(Math.max(params.limit ?? 24, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);
    const strictQuery = params.q ? buildPrefixTsQuery(params.q) : null;
    // relaxed: any word may match (OR); fuzzy: no full-text query at all, similarity decides instead.
    const tsQuery = params.fuzzy ? null : params.relaxed && strictQuery ? strictQuery.replace(/ & /g, ' | ') : strictQuery;
    const fuzzy = params.fuzzy === true && strictQuery !== null;

    const brands = parseList(params.brand);
    const stores = parseList(params.store);
    const colors = parseList(params.color).map(colorRegex).filter((r): r is string => r !== null);

    // `base` = what the text query matches (and the sold-out rule); facet counts are taken from here so that
    // picking one brand doesn't make every other brand's count drop to zero.
    // Typed text, lower-cased, with LIKE wildcards escaped: used to float exact / whole-phrase matches to the top.
    const phrase = (params.q ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    const phraseLike = phrase.replace(/[\\%_]/g, '\\$&');

    const hasSize = params.size !== undefined;
    // With a size picked, price, store count and store list come from that size's own in-stock listings.
    const priceCol = hasSize ? sql`sz.price` : sql`st.min_price`;
    const storeCountCol = hasSize ? sql`COALESCE(sz.stores, 0)` : sql`COALESCE(st.store_count, 0)`;
    const storeSlugsCol = hasSize ? sql`sz.slugs` : sql`st.store_slugs`;
    const sizeCol = hasSize ? sql`${params.size}::numeric` : sql`COALESCE(st.min_size, dv.size)`;
    const szCte = hasSize
      ? sql`, sz AS (
          SELECT v.sneaker_id, min(effective_price_inr(ps.price, ps.shipping_cost, ps.currency)) AS price,
                 count(DISTINCT ps.retailer_id)::int AS stores, array_agg(DISTINCT r.slug) AS slugs
          FROM price_snapshots ps
          JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
          JOIN retailers r ON r.id = ps.retailer_id
          WHERE v.size = ${params.size}::numeric AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'
          GROUP BY v.sneaker_id)`
      : sql``;
    const szJoin = hasSize ? sql`JOIN sz ON sz.sneaker_id = s.id` : sql``;
    // Just landed: the latest day any store first listed this shoe (baseline rows are not arrivals).
    const nwJoin = params.newDays !== undefined
      ? sql`LEFT JOIN LATERAL (SELECT max(f.first_seen) AS new_at FROM listing_first_seen f WHERE f.sneaker_id = s.id AND NOT f.is_baseline AND f.first_seen >= current_date - ${params.newDays}::int) nw ON true`
      : sql`LEFT JOIN LATERAL (SELECT NULL::date AS new_at) nw ON true`;

    const baseConditions = [];
    if (tsQuery) {
      // Words match as prefixes ("nik dun" finds Nike Dunk); a style code (has a digit) also matches by its start.
      baseConditions.push(
        /\d/.test(phrase)
          ? sql`(s.search_vector @@ to_tsquery('english', ${tsQuery}) OR lower(s.style_code) LIKE ${phraseLike + '%'})`
          : sql`s.search_vector @@ to_tsquery('english', ${tsQuery})`,
      );
    }
    if (fuzzy) baseConditions.push(sql`word_similarity(${phrase}, lower(s.brand || ' ' || s.model || ' ' || s.colorway)) > 0.45`);
    if (!params.includeSoldOut) baseConditions.push(sql`st.min_price IS NOT NULL`);
    const baseWhere = baseConditions.length > 0 ? sql`WHERE ${sql.join(baseConditions, sql` AND `)}` : sql``;

    const conditions = [...baseConditions];
    if (brands.length > 0) conditions.push(sql`s.brand IN (${sql.join(brands.map((b) => sql`${b}`), sql`, `)})`);
    if (stores.length > 0) conditions.push(sql`${storeSlugsCol} && ARRAY[${sql.join(stores.map((x) => sql`${x}`), sql`, `)}]::text[]`);
    if (colors.length > 0) conditions.push(sql`(${sql.join(colors.map((r) => sql`lower(s.colorway) ~ ${r}`), sql` OR `)})`);
    if (params.minPrice !== undefined) conditions.push(sql`${priceCol} >= ${params.minPrice}`);
    if (params.maxPrice !== undefined) conditions.push(sql`${priceCol} <= ${params.maxPrice}`);
    if (params.minStores !== undefined && params.minStores > 1) conditions.push(sql`${storeCountCol} >= ${params.minStores}`);
    if (params.signal) conditions.push(sql`ms.signal = ${params.signal}`);
    if (params.outlook) conditions.push(sql`ol.verdict = ${params.outlook}`);
    if (params.newDays !== undefined) conditions.push(sql`nw.new_at IS NOT NULL`);
    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    // Rank: an exact full name or style code first, then names that contain the whole phrase, then word-by-word relevance.
    const rankExpr = fuzzy
      ? sql`word_similarity(${phrase}, lower(s.brand || ' ' || s.model || ' ' || s.colorway))`
      : tsQuery
      ? sql`(ts_rank(s.search_vector, to_tsquery('english', ${tsQuery}))
          + CASE
              WHEN lower(s.style_code) = ${phrase}
                OR lower(s.brand || ' ' || s.model || ' ' || s.colorway) = ${phrase}
                OR lower(s.model || ' ' || s.colorway) = ${phrase}
                OR lower(s.model) = ${phrase} THEN 20
              WHEN lower(s.brand || ' ' || s.model) LIKE ${phraseLike + '%'}
                OR lower(s.model) LIKE ${phraseLike + '%'} THEN 10
              WHEN lower(s.brand || ' ' || s.model || ' ' || s.colorway) LIKE ${'%' + phraseLike + '%'} THEN 6
              WHEN lower(s.brand || ' ' || s.model) LIKE ${'%' + phraseLike + '%'} THEN 4
              WHEN lower(s.style_code) LIKE ${phraseLike + '%'} THEN 4
              ELSE 0
            END
          - length(s.model)::float / 1000)` // all else equal, the plainer (shorter) name first
      : sql`0`;
    // Unqualified column names, deliberately — the outer SELECT reads FROM matched (the CTE), where `s` is out of scope.
    // lower(): A to Z regardless of the database's collation. Shoes in stock somewhere come before sold-out ones.
    const alpha = sql`lower(brand) ASC, lower(model) ASC, colorway ASC`;
    const inStockFirst = sql`(best_available_price IS NULL) ASC`;
    // Default order: the shoes you can compare at the most stores first (that is what a comparison site is for), then a fixed
    // pseudo-random mix (md5 of the style code, the same every time) so no brand or store leads just because of its name.
    let orderBy = tsQuery || fuzzy ? sql`rank DESC, ${inStockFirst}, store_count DESC, ${alpha}` : sql`${inStockFirst}, store_count DESC, md5(style_code)`;
    if (params.sort === 'price_asc') orderBy = sql`${inStockFirst}, best_available_price ASC, ${alpha}`;
    else if (params.sort === 'price_desc') orderBy = sql`${inStockFirst}, best_available_price DESC, ${alpha}`;
    else if (params.sort === 'name_asc') orderBy = sql`lower(model) ASC, lower(brand) ASC, colorway ASC`;
    else if (params.sort === 'name_desc') orderBy = sql`lower(model) DESC, lower(brand) DESC, colorway DESC`;
    else if (params.sort === 'newest') orderBy = sql`nw_at DESC NULLS LAST, store_count DESC, md5(style_code)`;
    else if (params.sort === 'outlook') orderBy = sql`(outlook = 'buy_now') DESC, (outlook = 'fair') DESC, outlook_score DESC NULLS LAST, store_count DESC, md5(style_code)`;
    else if (params.sort === 'stores') orderBy = sql`store_count DESC, ${inStockFirst}, best_available_price ASC, ${alpha}`;

    // Shared CTEs. Both read materialized views (drizzle/0026) that are refreshed after every price import: the cheapest
    // in-stock price, store count and size per shoe (demo fixtures left out), and the variant whose signal a card shows.
    const ctes = sql`
      default_variant AS (SELECT sneaker_id, variant_id, size, size_system FROM catalog_default_variant_mv),
      st AS (SELECT sneaker_id, store_count, store_slugs, min_price, min_size, min_size_system FROM catalog_stats_mv)`;


    const colorCounts = sql.join(
      Object.keys(COLOR_FAMILIES).map((family) => sql`'${sql.raw(family)}', COALESCE((SELECT n FROM color_counts WHERE family = '${sql.raw(family)}'), 0)`),
      sql`, `,
    );

    const [{ rows }, facetResult, { rows: brandRows }, communityPosts] = await Promise.all([
      this.db.execute(sql`
        WITH ${ctes}${szCte},
        matched AS (
          SELECT s.style_code, s.brand, s.model, s.colorway, s.silhouette, s.primary_image_url,
                 ${sizeCol} AS size, COALESCE(st.min_size_system, dv.size_system) AS size_system,
                 ${priceCol} AS current_price, ${priceCol} AS best_available_price,
                 ms.signal, ms.currency, ${storeCountCol} AS store_count, ${storeSlugsCol} AS store_slugs,
                 ol.verdict AS outlook, ol.score AS outlook_score, nw.new_at AS nw_at,
                 lower(s.brand) || '|' || regexp_replace(lower(s.model), '[^a-z0-9]+', '', 'g') AS grp,
                 ${rankExpr} AS rank
          FROM sneakers s
          JOIN default_variant dv ON dv.sneaker_id = s.id
          LEFT JOIN st ON st.sneaker_id = s.id
          ${szJoin}
          ${nwJoin}
          LEFT JOIN LATERAL (SELECT o.verdict, o.score FROM sneaker_variants v2 JOIN outlook_latest o ON o.sneaker_variant_id = v2.id WHERE v2.sneaker_id = s.id AND v2.size = ${sizeCol} LIMIT 1) ol ON true
          LEFT JOIN market_summaries ms ON ms.sneaker_variant_id = dv.variant_id
          ${where}
        ),
        -- One card per model: the best-ranked colourway of each model stands for it.
        firsts AS (
          SELECT * FROM (SELECT matched.*, row_number() OVER (PARTITION BY grp ORDER BY ${orderBy}) AS rn FROM matched) x
          WHERE rn = 1
        ),
        page AS (
          SELECT *, count(*) OVER() AS total_count FROM firsts ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}
        )
        SELECT p.*,
               (SELECT json_agg(t) FROM (
                  SELECT m.style_code AS "styleCode", m.colorway, m.primary_image_url AS "primaryImageUrl",
                         m.size AS "defaultSize", m.best_available_price AS "bestAvailablePrice"
                  FROM matched m WHERE m.grp = p.grp
                  ORDER BY (m.style_code = p.style_code) DESC, m.best_available_price ASC NULLS LAST, m.colorway
                  LIMIT 60) t) AS colours
        FROM page p
        ORDER BY ${orderBy}
      `),
      // One statement for every facet, over one shared `base` scan.
      this.db.execute(sql`
        WITH ${ctes}${szCte},
        base AS MATERIALIZED (
          SELECT s.brand, s.colorway, ${storeSlugsCol} AS store_slugs, ${priceCol} AS min_price, cm.families
          FROM sneakers s LEFT JOIN st ON st.sneaker_id = s.id
          ${szJoin}
          LEFT JOIN catalog_colors_mv cm ON cm.sneaker_id = s.id ${baseWhere}
        ),
        color_counts AS (
          SELECT f AS family, count(*) AS n FROM base CROSS JOIN LATERAL unnest(COALESCE(base.families, ARRAY[]::text[])) AS f GROUP BY f
        )
        SELECT
          (SELECT COALESCE(json_agg(b), '[]'::json) FROM (
             SELECT brand AS value, count(*) AS n FROM base GROUP BY brand ORDER BY lower(brand) LIMIT 120) b) AS brands,
          (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
             SELECT r.slug, r.name, count(*) AS n
             FROM base CROSS JOIN LATERAL unnest(base.store_slugs) AS u(slug)
             JOIN retailers r ON r.slug = u.slug
             GROUP BY r.slug, r.name ORDER BY count(*) DESC) x) AS stores,
          (SELECT json_build_object(${colorCounts}) ) AS colors,
          (SELECT json_build_object('lo', min(min_price), 'hi', max(min_price),
                                    'p98', percentile_cont(0.98) WITHIN GROUP (ORDER BY min_price))
             FROM base WHERE min_price IS NOT NULL) AS price
      `),
      this.db.execute(sql`SELECT brand FROM sneakers GROUP BY brand ORDER BY lower(brand), brand`),
      this.searchCommunityPosts(params.q),
    ]);

    const { rows: retailerRows } = await this.db.execute(sql`SELECT slug, name, logo_url FROM retailers WHERE status = 'active' ORDER BY name`);
    const storeName = new Map((retailerRows as { slug: string; name: string }[]).map((x) => [x.slug, x.name]));
    // The sizes and store prices for each card's first colour (the one it opens on). Other colours load their own when hovered.
    const firstColours = (rows as unknown as SearchRow[]).map((r) => r.colours?.[0]).filter((c): c is NonNullable<typeof c> => Boolean(c));
    const perColour = await this.cardStock(firstColours.map((c) => c.styleCode), firstColours.map((c) => [c.styleCode, Number(c.defaultSize)] as const));

    const results = (rows as unknown as SearchRow[]).map((r) => ({
      styleCode: r.style_code,
      brand: r.brand,
      model: r.model,
      colorway: r.colorway,
      silhouette: r.silhouette,
      primaryImageUrl: r.primary_image_url,
      defaultSize: Number(r.size),
      defaultSizeSystem: r.size_system,
      currentPrice: r.current_price !== null ? Number(r.current_price) : null,
      bestAvailablePrice: r.best_available_price !== null ? Number(r.best_available_price) : null,
      signal: (r.signal as Signal | null) ?? null,
      outlook: r.outlook === 'buy_now' || r.outlook === 'wait' || r.outlook === 'fair' || r.outlook === 'unclear' ? (r.outlook as 'buy_now' | 'wait' | 'fair' | 'unclear') : null,
      currency: r.currency ?? 'INR',
      storeCount: Number(r.store_count ?? 0),
      storeNames: (r.store_slugs ?? []).map((slug) => storeName.get(slug) ?? slug).sort((a, b) => a.localeCompare(b)),
      colours: (r.colours ?? []).map((c) => ({
        styleCode: c.styleCode,
        colorway: c.colorway,
        primaryImageUrl: c.primaryImageUrl,
        defaultSize: Number(c.defaultSize),
        bestAvailablePrice: c.bestAvailablePrice !== null ? Number(c.bestAvailablePrice) : null,
        sizes: perColour.get(c.styleCode)?.sizes ?? [],
        storeSlugs: perColour.get(c.styleCode)?.slugs ?? [],
        sizeList: perColour.get(c.styleCode)?.sizeList ?? [],
        offers: perColour.get(c.styleCode)?.offers ?? [],
      })),
    }));

    const facetRow = (facetResult.rows[0] ?? {}) as {
      brands: Array<{ value: string; n: string | number }> | null;
      stores: Array<{ slug: string; name: string; n: string | number }> | null;
      colors: Record<string, string | number> | null;
      price: { lo: number | null; hi: number | null; p98: number | null } | null;
    };
    const price = facetRow.price ?? { lo: null, hi: null, p98: null };

    return {
      results,
      storeDirectory: (retailerRows as unknown as { slug: string; name: string; logo_url: string | null }[]).map((x) => ({ slug: x.slug, name: x.name, logoUrl: x.logo_url })),
      total: rows.length > 0 ? Number((rows[0] as unknown as SearchRow).total_count) : 0,
      brands: (brandRows as unknown as { brand: string }[]).map((b) => b.brand),
      facets: {
        brands: (facetRow.brands ?? []).map((b) => ({ value: b.value, count: Number(b.n) })),
        stores: (facetRow.stores ?? []).map((x) => ({ slug: x.slug, name: x.name, count: Number(x.n) })),
        colors: Object.keys(COLOR_FAMILIES)
          .map((family) => ({ value: family, count: Number(facetRow.colors?.[family] ?? 0) }))
          .filter((c) => c.count > 0),
        price: {
          min: price.lo != null ? Math.floor(Number(price.lo)) : 0,
          max: price.hi != null ? Math.ceil(Number(price.hi)) : 0,
          p98: price.p98 != null ? Math.ceil(Number(price.p98)) : 0,
        },
      },
      communityPosts,
    };
  }

  /**
   * Shoes similar to this one, for the "similar sneakers" rail: same model first (other colourways),
   * then the same brand's closest model names. Only shoes that are in stock somewhere, each with the
   * size and price of its cheapest in-stock listing so the card links straight to a priced page.
   */
  async similar(styleCode: string, limit = 8): Promise<SearchResultItem[]> {
    const capped = Math.min(Math.max(limit, 1), 24);
    const { rows } = await this.db.execute(sql`
      WITH t AS (
        SELECT id, lower(brand) AS brand, lower(model) AS model,
               to_tsquery('english', regexp_replace(trim(regexp_replace(model, '[^A-Za-z0-9]+', ' ', 'g')), ' +', ' | ', 'g')) AS q
        FROM sneakers WHERE style_code = ${styleCode}
      ),
      candidates AS (
        SELECT s.id, s.style_code, s.brand, s.model, s.colorway, s.silhouette, s.primary_image_url,
               (lower(s.model) = t.model) AS same_model,
               ((lower(s.model) = t.model)::int * 4 + (lower(s.brand) = t.brand)::int * 2
                 + ts_rank(s.search_vector, t.q)) AS score
        FROM sneakers s, t
        WHERE s.id <> t.id
          AND lower(s.brand) = t.brand
          AND s.search_vector @@ t.q
        ORDER BY score DESC, s.style_code
        LIMIT 40
      )
      SELECT c.style_code, c.brand, c.model, c.colorway, c.silhouette, c.primary_image_url, c.same_model,
             bp.size, bp.size_system, bp.price, bp.retailer_name, bp.listing_url
      FROM candidates c
      JOIN LATERAL (
        SELECT v.size, v.size_system, effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price,
               r.name AS retailer_name, ps.listing_url
        FROM sneaker_variants v
        JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.in_stock = true AND ps.listing_url NOT LIKE '%FIXTURE%'
        JOIN retailers r ON r.id = ps.retailer_id
        WHERE v.sneaker_id = c.id
        ORDER BY price ASC NULLS LAST
        LIMIT 1
      ) bp ON bp.price IS NOT NULL
      ORDER BY c.score DESC, bp.price ASC
      LIMIT ${capped}
    `);
    return (rows as unknown as Array<{
      style_code: string; brand: string; model: string; colorway: string; silhouette: string | null;
      primary_image_url: string | null; size: string; size_system: string; price: string;
      same_model: boolean; retailer_name: string; listing_url: string;
    }>).map((r) => ({
      styleCode: r.style_code,
      brand: r.brand,
      model: r.model,
      colorway: r.colorway,
      silhouette: r.silhouette,
      primaryImageUrl: r.primary_image_url,
      defaultSize: Number(r.size),
      defaultSizeSystem: r.size_system,
      currentPrice: Number(r.price),
      bestAvailablePrice: Number(r.price),
      signal: null,
      currency: 'INR',
      sameModel: r.same_model,
      bestRetailerName: r.retailer_name,
      listingUrl: r.listing_url,
    }));
  }

  /**
   * Real price history for one variant: for each day a store's price was recorded, the cheapest in-stock listing
   * per store, and the day's best. Demo/fixture listings are excluded. Days with no recording are simply absent
   * (nothing is interpolated), so the chart only ever shows prices that were actually seen.
   */
  async priceHistory(styleCode: string, size: number, days = 90): Promise<PriceHistory> {
    const span = Math.min(Math.max(Math.floor(days), 1), 730);
    const { rows } = await this.db.execute(sql`
      SELECT (ps.fetched_at AT TIME ZONE 'Asia/Kolkata')::date::text AS day, r.slug, r.name,
             min(effective_price_inr(ps.price, ps.shipping_cost, ps.currency)) AS price
      FROM price_snapshots ps
      JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
      JOIN sneakers s ON s.id = v.sneaker_id
      JOIN retailers r ON r.id = ps.retailer_id
      WHERE s.style_code = ${styleCode} AND v.size = ${size}::numeric
        AND ps.in_stock = true AND ps.listing_url NOT LIKE '%FIXTURE%'
        AND ps.fetched_at >= now() - make_interval(days => ${span})
      GROUP BY 1, r.slug, r.name
      ORDER BY 1, price
    `);
    const byDay = new Map<string, PriceHistoryPoint>();
    for (const r of rows as unknown as Array<{ day: string; slug: string; name: string; price: string | null }>) {
      if (r.price === null) continue;
      const price = Number(r.price);
      let point = byDay.get(r.day);
      if (!point) {
        point = { day: r.day, bestPrice: price, bestStore: r.name, stores: [] };
        byDay.set(r.day, point);
      }
      point.stores.push({ slug: r.slug, name: r.name, price });
      if (price < point.bestPrice) {
        point.bestPrice = price;
        point.bestStore = r.name;
      }
    }
    const points = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    return { points, since: points[0]?.day ?? null };
  }

  /**
   * Every colourway of this shoe's model (same brand, same model name), this one first. Others only appear when
   * they are in stock somewhere, so the picker never offers a dead end. Each carries the UK sizes it has in stock.
   */
  async colours(styleCode: string): Promise<ColourOption[]> {
    const { rows } = await this.db.execute(sql`
      WITH t AS (SELECT id, lower(brand) AS b, regexp_replace(lower(model), '[^a-z0-9]+', '', 'g') AS m FROM sneakers WHERE style_code = ${styleCode})
      SELECT s.style_code, s.colorway, s.primary_image_url, (s.id = t.id) AS is_current,
             bp.size, bp.price, bp.sizes
      FROM sneakers s
      JOIN t ON lower(s.brand) = t.b AND regexp_replace(lower(s.model), '[^a-z0-9]+', '', 'g') = t.m
      LEFT JOIN LATERAL (
        SELECT (array_agg(v.size ORDER BY effective_price_inr(ps.price, ps.shipping_cost, ps.currency)))[1] AS size,
               min(effective_price_inr(ps.price, ps.shipping_cost, ps.currency)) AS price,
               array_agg(DISTINCT v.size ORDER BY v.size) AS sizes
        FROM sneaker_variants v
        JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.in_stock = true
                                AND ps.listing_url NOT LIKE '%FIXTURE%'
        WHERE v.sneaker_id = s.id
      ) bp ON true
      WHERE s.id = t.id OR bp.price IS NOT NULL
      ORDER BY (s.id = t.id) DESC, bp.price ASC NULLS LAST, s.colorway
      LIMIT 60
    `);
    type Row = { style_code: string; colorway: string; primary_image_url: string | null; is_current: boolean; size: string | null; price: string | null; sizes: string[] | string | null };
    const out: ColourOption[] = [];
    for (const r of rows as unknown as Row[]) {
      const sizes = parsePgArray(r.sizes).map(Number);
      out.push({
        styleCode: r.style_code,
        colorway: r.colorway,
        primaryImageUrl: r.primary_image_url,
        defaultSize: r.size !== null ? Number(r.size) : (sizes[0] ?? 0),
        sizesInStock: sizes,
        bestAvailablePrice: r.price !== null ? Number(r.price) : null,
        current: r.is_current,
      });
    }
    return out;
  }

  /** Side-by-side data for up to four shoes (the order requested is kept; unknown style codes are skipped). */
  async compare(styleCodes: string[]): Promise<CompareItem[]> {
    const codes = [...new Set(styleCodes.map((c) => c.trim()).filter(Boolean))].slice(0, 4);
    if (codes.length === 0) return [];
    const { rows } = await this.db.execute(sql`
      SELECT s.style_code, s.brand, s.model, s.colorway, s.primary_image_url,
             r.slug AS retailer_slug, r.name AS retailer_name,
             MIN(effective_price_inr(ps.price, ps.shipping_cost, ps.currency)) AS best_price,
             (array_agg(ps.listing_url ORDER BY effective_price_inr(ps.price, ps.shipping_cost, ps.currency) ASC))[1] AS listing_url,
             (array_agg(v.size ORDER BY effective_price_inr(ps.price, ps.shipping_cost, ps.currency) ASC))[1] AS cheapest_size,
             array_agg(DISTINCT v.size ORDER BY v.size) AS sizes
      FROM sneakers s
      JOIN sneaker_variants v ON v.sneaker_id = s.id
      JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.in_stock = true AND ps.listing_url NOT LIKE '%FIXTURE%'
      JOIN retailers r ON r.id = ps.retailer_id
      WHERE s.style_code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})
      GROUP BY s.style_code, s.brand, s.model, s.colorway, s.primary_image_url, r.slug, r.name
    `);
    type Row = {
      style_code: string; brand: string; model: string; colorway: string; primary_image_url: string | null;
      retailer_slug: string; retailer_name: string; best_price: string | null; listing_url: string;
      cheapest_size: string; sizes: string[] | string | null;
    };
    const bySneaker = new Map<string, CompareItem>();
    const cheapestSize = new Map<string, number>();
    for (const r of rows as unknown as Row[]) {
      let item = bySneaker.get(r.style_code);
      if (!item) {
        item = {
          styleCode: r.style_code, brand: r.brand, model: r.model, colorway: r.colorway,
          primaryImageUrl: r.primary_image_url, bestPrice: null, bestRetailerName: null,
          sizesInStock: [], linkSize: null, offers: [],
        };
        bySneaker.set(r.style_code, item);
      }
      if (r.best_price === null) continue;
      const price = Number(r.best_price);
      const sizes = parsePgArray(r.sizes).map(Number);
      item.offers.push({ retailerSlug: r.retailer_slug, retailerName: r.retailer_name, bestPrice: price, listingUrl: r.listing_url, sizesInStock: sizes });
      item.sizesInStock = [...new Set([...item.sizesInStock, ...sizes])].sort((a, b) => a - b);
      if (item.bestPrice === null || price < item.bestPrice) {
        item.bestPrice = price;
        item.bestRetailerName = r.retailer_name;
        cheapestSize.set(r.style_code, Number(r.cheapest_size));
      }
    }
    for (const item of bySneaker.values()) {
      item.offers.sort((a, b) => a.bestPrice - b.bestPrice);
      item.linkSize = cheapestSize.get(item.styleCode) ?? null;
    }
    // Shoes with no priced listing still show up (as "unavailable") so a requested column never silently vanishes.
    const missing = codes.filter((c) => !bySneaker.has(c));
    if (missing.length > 0) {
      const { rows: plain } = await this.db.execute(sql`
        SELECT style_code, brand, model, colorway, primary_image_url FROM sneakers
        WHERE style_code IN (${sql.join(missing.map((c) => sql`${c}`), sql`, `)})
      `);
      for (const r of plain as unknown as Array<{ style_code: string; brand: string; model: string; colorway: string; primary_image_url: string | null }>) {
        bySneaker.set(r.style_code, {
          styleCode: r.style_code, brand: r.brand, model: r.model, colorway: r.colorway,
          primaryImageUrl: r.primary_image_url, bestPrice: null, bestRetailerName: null,
          sizesInStock: [], linkSize: null, offers: [],
        });
      }
    }
    return codes.map((c) => bySneaker.get(c)).filter((i): i is CompareItem => Boolean(i));
  }

  /**
   * Day 24 task 1's community half of unified search. Deliberately
   * `ILIKE`, not a `tsvector` column like `sneakers.search_vector` —
   * that was a real investment (Day 11's own migration + GENERATED
   * column + index) worth making for the catalog's primary browse
   * surface; community posts are a secondary, capped-at-5 result group
   * here, not their own ranked search experience, so a substring match
   * is the honest amount of engineering for what this actually is today.
   * Revisit with a real tsvector if/when community search grows into
   * something people use on its own, not just as a search-page sidebar.
   * `is_removed = false` so a moderator-hidden post never surfaces here
   * — the same enforcement every other read path already respects.
   */
  private async searchCommunityPosts(q?: string): Promise<CommunityPostSearchResult[]> {
    if (!q?.trim()) return [];
    const { rows } = await this.db.execute(sql`
      SELECT p.id, p.post_type, p.title, p.body, p.created_at, u.display_name AS author_display_name
      FROM posts p
      JOIN users u ON u.id = p.author_user_id
      WHERE p.is_removed = false
        AND (p.title ILIKE ${'%' + q.trim() + '%'} OR p.body ILIKE ${'%' + q.trim() + '%'})
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    return (rows as unknown as { id: string; post_type: string; title: string | null; body: string | null; created_at: string; author_display_name: string | null }[]).map(
      (r) => ({
        id: r.id,
        postType: r.post_type,
        title: r.title,
        preview: ((r.title ? r.title + ' — ' : '') + (r.body ?? '')).slice(0, 160),
        authorDisplayName: r.author_display_name,
        createdAt: new Date(r.created_at).toISOString(),
      }),
    );
  }

  /**
   * Every (style_code, size) pair with at least one retailer mapping —
   * feeds Next's generateStaticParams() so the price comparison page is
   * pre-rendered and cached as a real static route per variant, instead
   * of every request re-rendering on demand. Found via Day 11's load
   * test: without this, the page built as a Dynamic (ƒ) route despite
   * `revalidate = 300`, and concurrent requests queued through
   * per-request React rendering on a single Node process — see
   * load-tests/run-report.md for the before/after numbers.
   */
  async listVariantParams(): Promise<{ styleCode: string; size: number }[]> {
    const { rows } = await this.db.execute(sql`
      SELECT DISTINCT s.style_code, v.size
      FROM sneaker_variants v
      JOIN sneakers s ON s.id = v.sneaker_id
      WHERE EXISTS (SELECT 1 FROM retailer_product_mappings rpm WHERE rpm.sneaker_id = s.id)
      ORDER BY s.style_code, v.size
    `);
    return (rows as unknown as { style_code: string; size: string }[]).map((r) => ({
      styleCode: r.style_code,
      size: Number(r.size),
    }));
  }
}

export interface PriceDrop {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  size: number;
  previousPrice: number;
  currentPrice: number;
  dropPct: number;
  store: string;
  previousDay: string;
  currentDay: string;
}

export interface StoreDiscount {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  size: number;
  wasPrice: number;
  price: number;
  discountPct: number;
  store: string;
}

export interface StoreSummary {
  totalShoes: number;
  totalBrands: number;
  stores: Array<{
    slug: string;
    name: string;
    baseUrl: string | null;
    logoUrl: string | null;
    shoes: number;
    brands: number;
    sharePct: number;
    lastUpdated: string | null;
    deliveryMinDays: number | null;
    deliveryMaxDays: number | null;
  }>;
}

interface SearchRow {
  outlook?: string | null;
  colours?: Array<{ styleCode: string; colorway: string; primaryImageUrl: string | null; defaultSize: string; bestAvailablePrice: string | null}> | null;
  store_count?: string | number;
  store_slugs?: string[] | null;
  style_code: string;
  brand: string;
  model: string;
  colorway: string;
  silhouette: string | null;
  primary_image_url: string | null;
  size: string;
  size_system: string;
  current_price: string | null;
  best_available_price: string | null;
  signal: string | null;
  currency: string | null;
  total_count: string;
}

/**
 * User input -> a safe prefix tsquery ("dun jo" -> "dun:* & jo:*"), so
 * "query-as-you-type" (task 2) matches while the last word is still
 * being typed. Tokens are stripped to word characters/hyphens before
 * being joined into the tsquery string — not because string
 * interpolation into `sql` is unsafe here (it still goes through as a
 * bound parameter, same as any other value), but because an
 * unsanitized token can contain tsquery's own operators (&, |, :, ()) and
 * make to_tsquery() throw on malformed syntax. Returns null (skip the
 * search filter entirely) rather than ever passing an empty/invalid
 * query through, which fails open to "show everything" instead of a
 * confusing empty result.
 */
function buildPrefixTsQuery(q: string): string | null {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, ''))
    .filter(Boolean)
    .slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}:*`).join(' & ');
}
