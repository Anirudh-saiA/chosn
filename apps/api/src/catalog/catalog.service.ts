import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { MarketIntelligenceService, type MarketIntelligenceSummary } from '../pricing/market-intelligence.service';

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
             r.fetch_frequency_minutes,
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
      };
    });
  }
}
