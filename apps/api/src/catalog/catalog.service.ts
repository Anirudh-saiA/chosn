import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import {
  MarketIntelligenceService,
  type MarketIntelligenceSummary,
  type Signal,
} from '../pricing/market-intelligence.service';
import { retailerModeFor, type RetailerMode } from '../retailers/retailer-mode';

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
}

export interface CatalogResponse {
  sneaker: CatalogSneaker;
  variant: CatalogVariant;
  siblingSizes: SiblingSize[];
  offers: CatalogOffer[];
  marketIntelligence: MarketIntelligenceSummary | null;
}

/** node-postgres hands numeric[] back as the text "{3,3.5}" unless a type parser is registered. */
function parsePgArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.replace(/^\{|\}$/g, '').split(',').filter((v) => v !== '');
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

export interface SearchParams {
  q?: string;
  brand?: string;
  signal?: string;
  limit?: number;
  offset?: number;
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
  currency: string;
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
  total: number;
  /** Every brand in the catalog, unfiltered — populates the filter UI regardless of the current query. */
  brands: string[];
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

    const [siblings, offers, marketIntelligence] = await Promise.all([
      this.siblingSizes(variantRow.sneaker_id),
      this.offersFor(variantRow.variant_id),
      this.intelligence.getCached(variantRow.variant_id),
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
      offers,
      marketIntelligence,
    };
  }

  private async siblingSizes(sneakerId: string): Promise<SiblingSize[]> {
    const { rows } = await this.db.execute(sql`
      SELECT size, size_system FROM sneaker_variants
      WHERE sneaker_id = ${sneakerId}
      ORDER BY size ASC
    `);
    return (rows as unknown as { size: string; size_system: string }[]).map((r) => ({
      size: Number(r.size),
      sizeSystem: r.size_system,
    }));
  }

  private async offersFor(variantId: string): Promise<CatalogOffer[]> {
    const { rows } = await this.db.execute(sql`
      SELECT r.slug AS retailer_slug, r.name AS retailer_name, r.logo_url AS retailer_logo_url,
             r.fetch_frequency_minutes, r.integration_type::text AS integration_type,
             ps.price, ps.shipping_cost, ps.currency, ps.condition, ps.in_stock,
             ps.listing_url, ps.image_url, ps.fetched_at,
             effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS effective_price_inr
      FROM price_snapshots ps
      JOIN retailers r ON r.id = ps.retailer_id
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
   * "Default size" = each sneaker's lowest listed size. There's no real
   * popularity signal to rank by yet at this catalog size — a documented,
   * deterministic choice rather than an arbitrary one, easy to swap for
   * an actual "most-ordered size" once that data exists.
   *
   * Filtering is a SQL WHERE clause (brand, signal, full-text query),
   * never a client-side filter of the whole catalog — task 3.
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const limit = Math.min(Math.max(params.limit ?? 24, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);
    const tsQuery = params.q ? buildPrefixTsQuery(params.q) : null;

    const conditions = [];
    if (tsQuery) conditions.push(sql`s.search_vector @@ to_tsquery('english', ${tsQuery})`);
    if (params.brand) conditions.push(sql`s.brand = ${params.brand}`);
    if (params.signal) conditions.push(sql`ms.signal = ${params.signal}`);
    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const rankExpr = tsQuery
      ? sql`ts_rank(s.search_vector, to_tsquery('english', ${tsQuery}))`
      : sql`0`;
    // Unqualified column names, deliberately — the outer SELECT reads
    // FROM matched (the CTE), where `s` is out of scope; `s.brand` here
    // threw "missing FROM-clause entry for table s" until caught by
    // actually running the query rather than trusting it by inspection.
    // lower(): A to Z regardless of the database's collation (a C collation sorts every capital before every lowercase letter).
    const orderBy = tsQuery
      ? sql`rank DESC, lower(brand) ASC, lower(model) ASC, colorway ASC`
      : sql`lower(brand) ASC, lower(model) ASC, colorway ASC`;

    const [{ rows }, { rows: brandRows }, communityPosts] = await Promise.all([
      this.db.execute(sql`
        WITH default_variant AS (
          SELECT DISTINCT ON (sneaker_id) sneaker_id, id AS variant_id, size, size_system
          FROM sneaker_variants
          ORDER BY sneaker_id, size ASC
        ),
        matched AS (
          SELECT s.style_code, s.brand, s.model, s.colorway, s.silhouette, s.primary_image_url,
                 dv.size, dv.size_system,
                 ms.current_price, ms.best_available_price, ms.signal, ms.currency,
                 ${rankExpr} AS rank
          FROM sneakers s
          JOIN default_variant dv ON dv.sneaker_id = s.id
          LEFT JOIN market_summaries ms ON ms.sneaker_variant_id = dv.variant_id
          ${where}
        )
        SELECT *, count(*) OVER() AS total_count
        FROM matched
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `),
      this.db.execute(sql`SELECT brand FROM sneakers GROUP BY brand ORDER BY lower(brand), brand`),
      this.searchCommunityPosts(params.q),
    ]);

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
      currency: r.currency ?? 'INR',
    }));

    return {
      results,
      total: rows.length > 0 ? Number((rows[0] as unknown as SearchRow).total_count) : 0,
      brands: (brandRows as unknown as { brand: string }[]).map((b) => b.brand),
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
               ((lower(s.model) = t.model)::int * 4 + (lower(s.brand) = t.brand)::int * 2
                 + ts_rank(s.search_vector, t.q)) AS score
        FROM sneakers s, t
        WHERE s.id <> t.id
          AND lower(s.brand) = t.brand
          AND s.search_vector @@ t.q
        ORDER BY score DESC, s.style_code
        LIMIT 40
      )
      SELECT c.style_code, c.brand, c.model, c.colorway, c.silhouette, c.primary_image_url,
             bp.size, bp.size_system, bp.price
      FROM candidates c
      JOIN LATERAL (
        SELECT v.size, v.size_system, effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price
        FROM sneaker_variants v
        JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.in_stock = true
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
    }));
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
      JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id AND ps.is_latest = true AND ps.in_stock = true
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

interface SearchRow {
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
