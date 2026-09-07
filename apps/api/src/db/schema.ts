/**
 * Canonical schema — the Day 1 foundation spec's data model expressed as
 * Drizzle tables. Field lists follow that document, not the Day 6 task
 * shorthand, where the two differ:
 *   - `style_code` (not `sku`) is the canonical join key — it's the code
 *     printed on the box, and the key StockX/GOAT already use internally.
 *   - Sneaker carries gender/category/currency; SneakerVariant carries
 *     size_system (Indian retailers list UK, resale lists US — the source
 *     system is recorded, never silently rewritten).
 *   - PriceSnapshot carries price_type, listing_url, authenticity_verified
 *     and is_latest. listing_url matters most: it's what "View Deal"
 *     opens, and without it the CTA has nowhere to send anyone.
 *
 * The DDL itself lives in hand-authored SQL under drizzle/ rather than
 * being generated: price_snapshots is a partitioned table, which Drizzle
 * (like Prisma) can't express in its schema DSL. Drizzle owns the typed
 * query layer; the migrations own the physical layout.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------- enums

export const genderEnum = pgEnum('gender', ['men', 'women', 'unisex', 'gs', 'td']);
export const categoryEnum = pgEnum('category', ['basketball', 'lifestyle', 'running', 'skate']);
export const sizeSystemEnum = pgEnum('size_system', ['us', 'uk', 'eu', 'cm']);
export const regionEnum = pgEnum('region', ['india', 'us', 'global']);

/**
 * Day 1 §01 deliberately dropped `scrape` from the original
 * api/partner/scrape triple: every Tier 2 source is priced manually
 * instead, which sidesteps scraping-compliance risk rather than managing
 * it. There is no enum value for scraping here because there is no code
 * path for it.
 */
export const integrationTypeEnum = pgEnum('integration_type', [
  'api',
  'affiliate_feed',
  'partner',
  'manual',
]);
export const retailerStatusEnum = pgEnum('retailer_status', [
  'active',
  'pending_integration',
  'legal_review',
]);
export const conditionEnum = pgEnum('condition', ['new', 'used']);
export const priceTypeEnum = pgEnum('price_type', ['retail', 'resale', 'auction']);
export const mappingConfidenceEnum = pgEnum('mapping_confidence', ['manual', 'verified', 'fuzzy']);

// --------------------------------------------------------------- tables

export const sneakers = pgTable(
  'sneakers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    silhouette: text('silhouette'),
    colorway: text('colorway').notNull(),
    /** Canonical join key — see Day 1 §03. */
    styleCode: text('style_code').notNull(),
    gender: genderEnum('gender').notNull().default('unisex'),
    category: categoryEnum('category'),
    releaseDate: date('release_date'),
    retailPrice: numeric('retail_price', { precision: 12, scale: 2 }),
    /** retail_price alone is ambiguous across INR/USD. */
    currency: text('currency').notNull().default('INR'),
    primaryImageUrl: text('primary_image_url'),
    galleryImageRefs: text('gallery_image_refs').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // search_vector (tsvector, GENERATED ALWAYS ... STORED) also exists
    // physically — see 0005_sneaker_search.sql. Not modeled here:
    // CatalogService only ever reaches it through `@@ to_tsquery(...)`
    // in raw sql`` calls, never Drizzle's typed select/insert builder,
    // and drizzle-orm has no first-class tsvector column type to
    // declare it as. Same convention as price_snapshots' partitioning —
    // Drizzle owns the typed query layer, the migration owns physical
    // columns nothing here needs to read back as a JS value.
  },
  (t) => ({
    styleCodeIdx: uniqueIndex('sneakers_style_code_key').on(t.styleCode),
  }),
);

export const sneakerVariants = pgTable(
  'sneaker_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sneakerId: uuid('sneaker_id')
      .notNull()
      .references(() => sneakers.id, { onDelete: 'cascade' }),
    size: numeric('size', { precision: 4, scale: 1 }).notNull(),
    sizeSystem: sizeSystemEnum('size_system').notNull(),
    region: regionEnum('region').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One row per (shoe, size, system, region) — re-fetching must not
    // silently create duplicate variants for the same physical listing.
    uniq: uniqueIndex('sneaker_variants_unique').on(t.sneakerId, t.size, t.sizeSystem, t.region),
    sneakerIdx: index('sneaker_variants_sneaker_idx').on(t.sneakerId),
  }),
);

export const retailers = pgTable(
  'retailers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoUrl: text('logo_url'),
    baseUrl: text('base_url').notNull(),
    integrationType: integrationTypeEnum('integration_type').notNull(),
    affiliateLinkTemplate: text('affiliate_link_template'),
    regionFocus: regionEnum('region_focus').notNull(),
    /** Operationalizes Day 1 §01's cadence column: 12–24h retail, 1–4h resale. */
    fetchFrequencyMinutes: integer('fetch_frequency_minutes').notNull().default(720),
    /** A pointer into the secrets store — never the credential itself. */
    apiCredentialsRef: text('api_credentials_ref'),
    status: retailerStatusEnum('status').notNull().default('pending_integration'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('retailers_slug_key').on(t.slug),
  }),
);

/**
 * Append-only price history — one row per fetch, never updated in place.
 *
 * Physically this is a RANGE-partitioned table (monthly, on fetched_at);
 * see drizzle/0001_price_snapshots_partition.sql. Drizzle addresses it as
 * a single table, which is exactly how Postgres presents a partitioned
 * parent, so queries here need no special handling.
 *
 * The composite index (sneaker_variant_id, fetched_at DESC) is the one
 * every price page hits — "this variant's history, newest first."
 */
export const priceSnapshots = pgTable(
  'price_snapshots',
  {
    id: uuid('id').notNull().defaultRandom(),
    sneakerVariantId: uuid('sneaker_variant_id')
      .notNull()
      .references(() => sneakerVariants.id, { onDelete: 'cascade' }),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'restrict' }),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    shippingCost: numeric('shipping_cost', { precision: 12, scale: 2 }),
    currency: text('currency').notNull(),
    condition: conditionEnum('condition').notNull().default('new'),
    priceType: priceTypeEnum('price_type').notNull(),
    inStock: boolean('in_stock').notNull(),
    /** Deep link to this exact size — what "View Deal" opens. */
    listingUrl: text('listing_url').notNull(),
    authenticityVerified: boolean('authenticity_verified').notNull().default(false),
    /** Fast current-price lookup without scanning history. */
    isLatest: boolean('is_latest').notNull().default(true),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    variantTimeIdx: index('price_snapshots_variant_fetched_idx').on(
      t.sneakerVariantId,
      t.fetchedAt.desc(),
    ),
    retailerIdx: index('price_snapshots_retailer_idx').on(t.retailerId),
  }),
);

/**
 * The manual mapping table from Day 1 §03 — what each retailer calls a
 * shoe, resolved to our style_code. At 30 models x 10 sources this tops
 * out around 300 rows, small enough to build and verify by hand.
 */
export const retailerProductMappings = pgTable(
  'retailer_product_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    sneakerId: uuid('sneaker_id')
      .notNull()
      .references(() => sneakers.id, { onDelete: 'cascade' }),
    /** Nullable until a size is confirmed on that listing. */
    sneakerVariantId: uuid('sneaker_variant_id').references(() => sneakerVariants.id, {
      onDelete: 'set null',
    }),
    retailerRawTitle: text('retailer_raw_title').notNull(),
    retailerProductUrl: text('retailer_product_url').notNull(),
    /** Denormalized from sneakers.style_code for fast lookup/audit. */
    styleCode: text('style_code').notNull(),
    /** The retailer's own product id, when it exposes one — the fetch key. */
    retailerProductId: text('retailer_product_id'),
    mappingConfidence: mappingConfidenceEnum('mapping_confidence').notNull().default('manual'),
    mappedBy: text('mapped_by'),
    mappedAt: timestamp('mapped_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
  },
  (t) => ({
    uniq: uniqueIndex('retailer_product_mappings_unique').on(t.retailerId, t.sneakerId),
    lookupIdx: index('retailer_product_mappings_lookup_idx').on(t.retailerId, t.styleCode),
  }),
);

/**
 * Computed cache powering Feature 2's summary block (Day 9's Market
 * Intelligence card). Refreshed hourly by MarketIntelligenceService, not
 * read — rolling aggregates over PriceSnapshot don't scale to a page
 * load once history is months deep, so this is the only table the price
 * page ever queries for these numbers.
 *
 * Every monetary column is INR, via effective_price_inr() (price +
 * shipping, currency-converted) — see 0004_market_intelligence.sql.
 * current_price and best_available_price are deliberately allowed to
 * differ: current_price is the freshest valid snapshot regardless of
 * stock ("what does this cost right now"), best_available_price is the
 * cheapest in-stock offer ("where would you actually buy it"). Both can
 * be null if every retailer is stale or unmapped.
 */
export const marketSummaries = pgTable('market_summaries', {
  sneakerVariantId: uuid('sneaker_variant_id')
    .primaryKey()
    .references(() => sneakerVariants.id, { onDelete: 'cascade' }),
  currentPrice: numeric('current_price', { precision: 12, scale: 2 }),
  currentRetailerId: uuid('current_retailer_id').references(() => retailers.id, {
    onDelete: 'set null',
  }),
  currentRetailerSlug: text('current_retailer_slug'),
  bestAvailablePrice: numeric('best_available_price', { precision: 12, scale: 2 }),
  bestRetailerId: uuid('best_retailer_id').references(() => retailers.id, {
    onDelete: 'set null',
  }),
  bestRetailerSlug: text('best_retailer_slug'),
  avg30d: numeric('avg_30d', { precision: 12, scale: 2 }),
  avg90d: numeric('avg_90d', { precision: 12, scale: 2 }),
  trendPct: numeric('trend_pct', { precision: 6, scale: 2 }),
  /** 'good_time_to_buy' | 'neutral' | 'consider_waiting' | 'insufficient_data' */
  signal: text('signal'),
  /** How many real daily_best_prices rows fed avg_30d / avg_90d. */
  daysHistory30d: integer('days_history_30d').notNull().default(0),
  daysHistory90d: integer('days_history_90d').notNull().default(0),
  /** False until daysHistory30d clears MIN_DAYS_FOR_SIGNAL — see the service. */
  sufficientData: boolean('sufficient_data').notNull().default(false),
  currency: text('currency').notNull().default('INR'),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per (variant, day): the cheapest available effective price a
 * buyer could actually get that day, across all retailers — not an
 * average of every offer. The hourly job upserts today's row; avg_30d /
 * avg_90d are then a cheap AVG() over this table rather than a live
 * aggregation over months of raw price_snapshots.
 */
export const dailyBestPrices = pgTable(
  'daily_best_prices',
  {
    sneakerVariantId: uuid('sneaker_variant_id')
      .notNull()
      .references(() => sneakerVariants.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    bestPriceInr: numeric('best_price_inr', { precision: 14, scale: 2 }).notNull(),
    bestRetailerId: uuid('best_retailer_id').references(() => retailers.id, {
      onDelete: 'set null',
    }),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // The physical PRIMARY KEY (sneaker_variant_id, day) is declared in
    // 0004_market_intelligence.sql — this mirrors it for Drizzle's typed
    // query builder, which doesn't own this table's DDL (see file header).
    uniq: uniqueIndex('daily_best_prices_variant_day_unique').on(t.sneakerVariantId, t.day),
    variantDayIdx: index('daily_best_prices_variant_day_idx').on(t.sneakerVariantId, t.day.desc()),
  }),
);

/**
 * Static, manually-maintained conversion rates to INR — see
 * effective_price_inr() in 0004_market_intelligence.sql for why
 * conversion happens at read time and never by rewriting price_snapshots.
 * No live FX feed is wired up; a currency with no row here is excluded
 * from ranking rather than compared to INR as if the numbers matched.
 */
export const fxRates = pgTable('fx_rates', {
  currency: text('currency').primaryKey(),
  rateToInr: numeric('rate_to_inr', { precision: 14, scale: 6 }).notNull(),
  source: text('source').notNull().default('static'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Day 5's table, brought under Drizzle rather than left hand-rolled. */
export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  interests: text('interests').array().notNull().default([]),
  source: text('source').notNull().default('landing_page'),
  confirmed: boolean('confirmed').notNull().default(true),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

// ------------------------------------------------------------ relations

export const sneakersRelations = relations(sneakers, ({ many }) => ({
  variants: many(sneakerVariants),
}));

export const sneakerVariantsRelations = relations(sneakerVariants, ({ one, many }) => ({
  sneaker: one(sneakers, {
    fields: [sneakerVariants.sneakerId],
    references: [sneakers.id],
  }),
  snapshots: many(priceSnapshots),
}));

export const priceSnapshotsRelations = relations(priceSnapshots, ({ one }) => ({
  variant: one(sneakerVariants, {
    fields: [priceSnapshots.sneakerVariantId],
    references: [sneakerVariants.id],
  }),
  retailer: one(retailers, {
    fields: [priceSnapshots.retailerId],
    references: [retailers.id],
  }),
}));

// ------------------------------------------------- day 7: manual + health

/**
 * Hand-entered prices for Tier 2 boutiques (Day 1 §01). Append-only like
 * price_snapshots: a correction is a new row, so there's always an audit
 * trail of who priced what and when. ManualPriceAdapter reads the newest
 * row per (retailer, variant) and refuses to serve a stale one.
 */
export const manualPriceEntries = pgTable(
  'manual_price_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    sneakerVariantId: uuid('sneaker_variant_id')
      .notNull()
      .references(() => sneakerVariants.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 12, scale: 2 }),
    shippingCost: numeric('shipping_cost', { precision: 12, scale: 2 }),
    currency: text('currency').notNull().default('INR'),
    condition: conditionEnum('condition').notNull().default('new'),
    inStock: boolean('in_stock').notNull().default(true),
    listingUrl: text('listing_url').notNull(),
    /** Who checked the shop — accountability for a manual process. */
    recordedBy: text('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
  },
  (t) => ({
    lookupIdx: index('manual_price_entries_lookup_idx').on(
      t.retailerId,
      t.sneakerVariantId,
      t.recordedAt.desc(),
    ),
  }),
);

/**
 * Terminal fetch failures, one row per dead-lettered job.
 *
 * The dead-letter queue already holds these, but Redis is a cache we're
 * willing to lose and BullMQ trims old jobs. Failure history is what the
 * health summary counts, so it belongs somewhere durable and queryable.
 */
export const fetchFailures = pgTable(
  'fetch_failures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    retailerSlug: text('retailer_slug').notNull(),
    styleCode: text('style_code'),
    size: numeric('size', { precision: 4, scale: 1 }),
    reason: text('reason').notNull(),
    attempts: integer('attempts').notNull().default(1),
    failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // The health summary asks "failures per retailer in the last 24h".
    recentIdx: index('fetch_failures_recent_idx').on(t.retailerSlug, t.failedAt.desc()),
  }),
);
