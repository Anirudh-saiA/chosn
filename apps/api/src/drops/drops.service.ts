import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { inIndiaTime, releaseInstant } from './drop-time';
import { parsePgTextArray } from './pg-array';

export type DropStatus = 'upcoming' | 'live' | 'sold_out';
/** Is it coming to India? "in_indian_stores" means a store we read lists it right now (worked out live, never stored). */
export type IndiaStatus = 'unknown' | 'confirmed_india' | 'global_only' | 'in_indian_stores';

export interface DropSneakerSummary {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  /** Where a stored picture came from, e.g. "Photo: nicekicks.com, via SoleDispatch". */
  imageCredit?: string | null;
}

export interface DropListItem {
  id: string;
  /** The retail price in rupees: as listed for India drops, converted at the latest exchange rate otherwise (null when there is no price or no rate yet). */
  retailPriceInr: number | null;
  /** Rupees per unit of the listed currency when a conversion was made, else null. */
  fxRate: number | null;
  /** How firm the date is: confirmed (an official page), reported (trackers agree) or unconfirmed. */
  confirmation: 'confirmed' | 'reported' | 'unconfirmed';
  /** Who confirmed this drop (a brand, retailer or publication) and where to read it. */
  sourceName: string | null;
  sourceUrl: string | null;
  status: DropStatus;
  releaseDate: string;
  releaseTime: string | null;
  releaseTimezone: string;
  /** The exact moment (ISO, UTC) when a clock time is known, else null. */
  releaseAt: string | null;
  /** "Thu, 5 Nov, 8:30 PM IST", or "Thu, 5 Nov (date only)". */
  indiaTime: string;
  indiaStatus: IndiaStatus;
  collab: string | null;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  sneaker: DropSneakerSummary;
}

export interface StoreListing {
  slug: string;
  name: string;
  price: number;
  size: number | null;
  url: string;
}

export interface PriceEstimate {
  low: number;
  median: number;
  high: number;
  pairs: number;
  basis: string;
}

export interface DropDetail extends DropListItem {
  purchaseLinks: unknown;
  raffleInfo: unknown;
  story: string | null;
  /** Lowest listed size for this sneaker — same convention CatalogService.search() already uses — the size this page links to for a price comparison / Market Intelligence check. */
  defaultVariant: { id: string; size: number; sizeSystem: string } | null;
  /** Stores we read that list this exact shoe right now, cheapest first. */
  inIndianStores: StoreListing[];
  /** The stores we read that carry the most pairs of this brand today (a hint about where a release usually shows up). */
  storesThatCarryBrand: Array<{ name: string; pairs: number }>;
  /** What similar pairs cost in Indian stores today: an estimate from our own data, never a forecast. */
  priceEstimate: PriceEstimate | null;
  relatedNews: { id: string; title: string; publishedAt: string; isBreaking: boolean }[];
}

const FX = `(SELECT f.rate_to_inr FROM fx_rates f WHERE f.currency = de.currency)`;
const IMG = `COALESCE(s.primary_image_url, (SELECT ps.image_url FROM price_snapshots ps JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id WHERE v.sneaker_id = s.id AND ps.is_latest AND ps.image_url IS NOT NULL LIMIT 1))`;
const COLS = `de.id, de.status, de.release_date, de.release_time, de.release_timezone, de.source_name, de.source_url, de.confirmation, de.india_status, de.hidden, de.is_demo,
      de.regions, de.retail_price, de.currency, de.story,
      CASE WHEN de.currency = 'INR' THEN de.retail_price ELSE de.retail_price * ${FX} END AS retail_price_inr,
      CASE WHEN de.currency = 'INR' THEN NULL ELSE ${FX} END AS fx_rate,
      s.style_code, s.brand, s.model, s.colorway, s.image_credit, ${IMG} AS primary_image_url`;

/**
 * Read layer for the drops calendar and drop pages. DropSchedulerService and the consumers under drop-*.{service,consumer}.ts own the
 * live/news writes; AdminDropsController, the importers and the maintenance job own the rest.
 */
@Injectable()
export class DropsService {
  private readonly brandStoreCache = new Map<string, { at: number; value: Array<{ name: string; pairs: number }> }>();

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * `from`/`to` bound `release_date` (inclusive). `statuses` narrows to specific statuses; omit for all three. Hidden (not approved)
   * drops are never listed here; the admin screen reads them through its own query.
   */
  async list(params: { from?: string; to?: string; statuses?: DropStatus[]; ids?: string[] } = {}): Promise<DropListItem[]> {
    const conditions: ReturnType<typeof sql>[] = [sql`NOT de.hidden`];
    if (!showDemo()) conditions.push(sql`NOT de.is_demo`);
    if (params.from) conditions.push(sql`de.release_date >= ${params.from}`);
    if (params.to) conditions.push(sql`de.release_date <= ${params.to}`);
    if (params.ids) {
      if (params.ids.length === 0) return [];
      conditions.push(sql`de.id IN (${sql.join(params.ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
    }
    if (params.statuses && params.statuses.length > 0) {
      // sql.join builds a real `IN ($1, $2, ...)` list; a plain JS array does not bind as one parameter in this ORM (see drops/README.md).
      conditions.push(sql`de.status IN (${sql.join(params.statuses.map((s) => sql`${s}`), sql`, `)})`);
    }
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    const { rows } = await this.db.execute(sql`
      SELECT ${sql.raw(COLS)}
      FROM drop_events de
      JOIN sneakers s ON s.id = de.sneaker_id
      ${where}
      ORDER BY de.release_date ASC, de.release_time ASC NULLS LAST
    `);
    const list = rows as Record<string, unknown>[];
    const inStores = await this.styleCodesInStores(list.map((r) => String(r.style_code)));
    return list.map((r) => rowToListItem(r, inStores.has(String(r.style_code))));
  }

  /** The drop ids behind a shopper's follows and reminders (single drops, plus upcoming drops of followed brands and collabs). */
  async followedDropIds(watch: string): Promise<string[]> {
    const { rows } = await this.db.execute(sql`
      SELECT de.id FROM drop_events de JOIN sneakers s ON s.id = de.sneaker_id
       WHERE NOT de.hidden AND (${showDemo() ? sql`TRUE` : sql`NOT de.is_demo`}) AND (
             de.id::text IN (SELECT ref FROM drop_follows WHERE watch_id = ${watch}::uuid AND kind = 'drop')
          OR de.id IN (SELECT drop_id FROM drop_reminders WHERE watch_id = ${watch}::uuid)
          OR (de.status <> 'sold_out' AND s.brand IN (SELECT ref FROM drop_follows WHERE watch_id = ${watch}::uuid AND kind = 'brand'))
          OR (de.status <> 'sold_out' AND EXISTS (SELECT 1 FROM drop_follows f WHERE f.watch_id = ${watch}::uuid AND f.kind = 'collab' AND s.model ILIKE '%' || f.ref || '%')))`);
    return (rows as Array<{ id: string }>).map((r) => r.id);
  }

  /** Style codes (from the given ones) that at least one store we read lists in stock right now. */
  async styleCodesInStores(codes: string[]): Promise<Set<string>> {
    if (codes.length === 0) return new Set();
    const { rows } = await this.db.execute(sql`
      SELECT DISTINCT s.style_code
        FROM sneakers s JOIN sneaker_variants v ON v.sneaker_id = s.id JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id
       WHERE s.style_code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)}) AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'`);
    return new Set((rows as Array<{ style_code: string }>).map((r) => r.style_code));
  }

  async getById(id: string): Promise<DropDetail | null> {
    const { rows } = await this.db.execute(sql`
      SELECT ${sql.raw(COLS)}, de.purchase_links, de.raffle_info
      FROM drop_events de
      JOIN sneakers s ON s.id = de.sneaker_id
      WHERE de.id = ${id}
      LIMIT 1
    `);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row || (row.is_demo === true && !showDemo()) || row.hidden === true) return null;

    const styleCode = String(row.style_code);
    const brand = String(row.brand);
    const model = String(row.model);

    const [{ rows: variantRows }, { rows: newsRows }, stores, carriers, estimate] = await Promise.all([
      this.db.execute(sql`
        SELECT sv.id, sv.size, sv.size_system
        FROM sneaker_variants sv
        JOIN sneakers s ON s.id = sv.sneaker_id
        WHERE s.style_code = ${styleCode}
        ORDER BY sv.size ASC
        LIMIT 1
      `),
      this.db.execute(sql`
        SELECT id, title, published_at, is_breaking
        FROM news_items
        WHERE drop_event_id = ${id}
        ORDER BY published_at DESC
      `),
      this.listingsFor(styleCode),
      this.storesThatCarry(brand),
      this.priceEstimate(brand, model),
    ]);

    const variantRow = variantRows[0] as Record<string, unknown> | undefined;

    return {
      ...rowToListItem(row, stores.length > 0),
      purchaseLinks: row.purchase_links,
      raffleInfo: row.raffle_info,
      story: (row.story as string) ?? null,
      defaultVariant: variantRow
        ? { id: String(variantRow.id), size: Number(variantRow.size), sizeSystem: String(variantRow.size_system) }
        : null,
      inIndianStores: stores,
      storesThatCarryBrand: carriers,
      priceEstimate: estimate,
      relatedNews: (newsRows as Record<string, unknown>[]).map((n) => ({
        id: String(n.id),
        title: String(n.title),
        publishedAt: new Date(n.published_at as string).toISOString(),
        isBreaking: Boolean(n.is_breaking),
      })),
    };
  }

  /** Each store's cheapest in-stock listing of this exact shoe, cheapest first. */
  private async listingsFor(styleCode: string): Promise<StoreListing[]> {
    const { rows } = await this.db.execute(sql`
      SELECT DISTINCT ON (r.id) r.slug, r.name, v.size, ps.listing_url,
             effective_price_inr(ps.price, ps.shipping_cost, ps.currency)::int AS price
        FROM sneakers s JOIN sneaker_variants v ON v.sneaker_id = s.id JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id JOIN retailers r ON r.id = ps.retailer_id
       WHERE s.style_code = ${styleCode} AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'
       ORDER BY r.id, effective_price_inr(ps.price, ps.shipping_cost, ps.currency) ASC`);
    return (rows as Array<{ slug: string; name: string; size: string; listing_url: string; price: number }>)
      .map((r) => ({ slug: r.slug, name: r.name, price: Number(r.price), size: Number(r.size), url: r.listing_url }))
      .sort((a, b) => a.price - b.price);
  }

  /** Which stores carry the most pairs of a brand today (cached for an hour: it only moves slowly). */
  private async storesThatCarry(brand: string): Promise<Array<{ name: string; pairs: number }>> {
    const hit = this.brandStoreCache.get(brand);
    if (hit && Date.now() - hit.at < 3_600_000) return hit.value;
    const { rows } = await this.db.execute(sql`
      SELECT r.name, count(DISTINCT s.id)::int AS pairs
        FROM sneakers s JOIN sneaker_variants v ON v.sneaker_id = s.id JOIN price_snapshots ps ON ps.sneaker_variant_id = v.id JOIN retailers r ON r.id = ps.retailer_id
       WHERE s.brand = ${brand} AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'
       GROUP BY r.name ORDER BY pairs DESC LIMIT 3`);
    const value = (rows as Array<{ name: string; pairs: number }>).map((r) => ({ name: r.name, pairs: Number(r.pairs) }));
    this.brandStoreCache.set(brand, { at: Date.now(), value });
    return value;
  }

  /**
   * An estimate of the Indian price from pairs of the same model that stores list today: the 25th, 50th and 75th percentile of their
   * lowest prices. It says how many pairs it is based on and is null when fewer than 5 pairs match. Not a forecast.
   */
  private async priceEstimate(brand: string, model: string): Promise<PriceEstimate | null> {
    const base = model.toLowerCase().replace(/["'()]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    if (base.length < 5) return null;
    const { rows } = await this.db.execute(sql`
      SELECT count(*)::int AS n,
             percentile_cont(0.25) WITHIN GROUP (ORDER BY st.min_price)::int AS p25,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY st.min_price)::int AS p50,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY st.min_price)::int AS p75
        FROM sneakers s JOIN catalog_stats_mv st ON st.sneaker_id = s.id
       WHERE s.brand = ${brand} AND lower(s.model) LIKE ${'%' + base + '%'} AND st.min_price IS NOT NULL`);
    const r = rows[0] as { n: number; p25: number; p50: number; p75: number } | undefined;
    if (!r || Number(r.n) < 5) return null;
    return { low: Number(r.p25), median: Number(r.p50), high: Number(r.p75), pairs: Number(r.n), basis: `${brand} ${base}` };
  }
}

export const showDemo = () => process.env.SHOW_DEMO_RELEASES === '1';

/** A picture we host ourselves (a relative /media path) becomes a full address on the API. */
const mediaUrl = (u: string | null): string | null => (u && u.startsWith('/media/') ? `${(process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '')}${u}` : u);

/** The collab in a model name written "Model x Partner" (how the importers name them), or null. */
const collabOf = (model: string): string | null => {
  const i = model.lastIndexOf(' x ');
  return i > 0 ? model.slice(i + 3).trim() || null : null;
};

function rowToListItem(row: Record<string, unknown>, inStores: boolean): DropListItem {
  const date = String(row.release_date).slice(0, 10);
  const time = (row.release_time as string) ?? null;
  const zone = String(row.release_timezone);
  const regions = parsePgTextArray(row.regions as string | null);
  const stored = String(row.india_status ?? 'unknown');
  const indiaStatus: IndiaStatus = inStores ? 'in_indian_stores' : stored === 'confirmed_india' || stored === 'global_only' ? stored : regions.includes('india') ? 'confirmed_india' : 'unknown';
  const at = releaseInstant({ date, time, timezone: zone });
  return {
    id: String(row.id),
    retailPriceInr: row.retail_price_inr != null ? Math.round(Number(row.retail_price_inr)) : null,
    fxRate: row.fx_rate != null ? Number(row.fx_rate) : null,
    confirmation: (['confirmed', 'reported', 'unconfirmed'].includes(String(row.confirmation)) ? row.confirmation : 'confirmed') as DropListItem['confirmation'],
    sourceName: (row.source_name as string) ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    status: row.status as DropStatus,
    releaseDate: date,
    releaseTime: time,
    releaseTimezone: zone,
    releaseAt: at ? at.toISOString() : null,
    indiaTime: inIndiaTime({ date, time, timezone: zone }),
    indiaStatus,
    collab: collabOf(String(row.model)),
    regions,
    retailPrice: (row.retail_price as string) ?? null,
    currency: String(row.currency),
    sneaker: {
      styleCode: String(row.style_code),
      brand: String(row.brand),
      model: String(row.model),
      colorway: String(row.colorway),
      primaryImageUrl: mediaUrl((row.primary_image_url as string) ?? null),
      imageCredit: (row.image_credit as string) ?? null,
    },
  };
}
