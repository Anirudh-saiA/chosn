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
             ps.listing_url, ps.fetched_at,
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
    const orderBy = tsQuery ? sql`rank DESC, brand ASC, model ASC` : sql`brand ASC, model ASC`;

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
      this.db.execute(sql`SELECT DISTINCT brand FROM sneakers ORDER BY brand`),
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
