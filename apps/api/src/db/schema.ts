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
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
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
export const dropStatusEnum = pgEnum('drop_status', ['upcoming', 'live', 'sold_out']);
export const subscriptionScopeEnum = pgEnum('subscription_scope', ['brand', 'model', 'global']);

// Day 17: trust & safety — see 0009_trust_safety.sql for the reasoning
// behind each of these (role vs. is_admin, why reported_entity_id isn't
// an FK, why blocks aren't soft-deletable).
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const reportEntityTypeEnum = pgEnum('report_entity_type', ['user', 'post', 'comment', 'message']);
export const reportReasonEnum = pgEnum('report_reason', [
  'harassment',
  'doxxing',
  'scam',
  'hate_speech',
  'spam',
  'other',
]);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'reviewed', 'actioned', 'dismissed']);

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
  /** Day 16 — set once this email creates a real account; never retroactively guessed, never deleted. See 0008_auth.sql. */
  linkedUserId: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
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

// -------------------------------------------------- day 12: drops + news
//
// See apps/api/drizzle/0006_drops_and_news.sql and
// apps/api/src/drops/README.md for the full reasoning — the schema
// comments here mirror the physical DDL, not repeat its rationale.

export const dropEvents = pgTable(
  'drop_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sneakerId: uuid('sneaker_id')
      .notNull()
      .references(() => sneakers.id, { onDelete: 'cascade' }),
    releaseDate: date('release_date').notNull(),
    /** NULL = date confirmed, hour still TBA — a real, displayable state. */
    releaseTime: time('release_time'),
    /** IANA zone name — survives a DST transition, a stored offset doesn't. */
    releaseTimezone: text('release_timezone').notNull().default('Asia/Kolkata'),
    regions: regionEnum('regions').array().notNull().default([]),
    retailPrice: numeric('retail_price', { precision: 12, scale: 2 }),
    currency: text('currency').notNull().default('INR'),
    status: dropStatusEnum('status').notNull().default('upcoming'),
    /** Official "where to try to buy at retail" links — never the resale/affiliate offers. */
    purchaseLinks: jsonb('purchase_links').notNull().default([]),
    /** NULL = standard FCFS release; present = raffle/draw metadata only. */
    raffleInfo: jsonb('raffle_info'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sneakerIdx: index('drop_events_sneaker_idx').on(t.sneakerId),
    statusIdx: index('drop_events_status_idx').on(t.status),
    // Day 12 noted here that Drizzle's builder couldn't express a
    // partial index — that was wrong, caught while wiring the Day 13
    // scheduler's own query against this same table: IndexBuilder does
    // have `.where()`. Mirrors 0006's `drop_events_upcoming_idx`.
    upcomingIdx: index('drop_events_upcoming_idx')
      .on(t.releaseDate, t.releaseTime)
      .where(sql`${t.status} = 'upcoming'`),
  }),
);

export const newsItems = pgTable(
  'news_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    dropEventId: uuid('drop_event_id').references(() => dropEvents.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull(),
    /** Set only when body is sourced from a licensed feed — NULL for CHOSN originals. */
    sourceUrl: text('source_url'),
    /** The only flag that should trigger an instant push — see drops/README.md. */
    isBreaking: boolean('is_breaking').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dropEventIdx: index('news_items_drop_event_idx').on(t.dropEventId),
    publishedIdx: index('news_items_published_idx').on(t.publishedAt.desc()),
    // Day 13: at most one auto-generated post per drop, even if this API
    // ever runs more than one instance — see 0007's header comment.
    autoPostUniq: uniqueIndex('news_items_auto_post_unique')
      .on(t.dropEventId)
      .where(sql`${t.source} = 'CHOSN (auto)'`),
  }),
);

/**
 * A bare identity anchor, not an account system — no password, no
 * session. CHOSN has no auth yet; this is the honest shape of what
 * exists until real accounts do (see drops/README.md, flagged for
 * sign-off).
 */
export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /** Day 16 — NULL means still anonymous; the existing no-login flow is unaffected either way. See 0008_auth.sql. */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
});

export const webPushSubscriptions = pgTable(
  'web_push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subscriberIdx: index('web_push_subscriptions_subscriber_idx').on(t.subscriberId),
  }),
);

export const notificationSubscriptions = pgTable(
  'notification_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    scopeType: subscriptionScopeEnum('scope_type').notNull(),
    /** Brand name or style_code depending on scopeType; NULL when scopeType = 'global'. */
    scopeValue: text('scope_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    scopeIdx: index('notification_subscriptions_scope_idx').on(t.scopeType, t.scopeValue),
    // Same correction as drop_events_upcoming_idx above — .on() also
    // accepts a raw SQL expression, not just column refs, so the
    // COALESCE-based uniqueness (catches duplicate 'global' rows, where
    // scope_value is NULL on every row and NULL <> NULL in a plain
    // unique constraint) is expressible here too. Mirrors 0006's
    // notification_subscriptions_unique.
    uniq: uniqueIndex('notification_subscriptions_unique').on(
      t.subscriberId,
      t.scopeType,
      sql`COALESCE(${t.scopeValue}, '')`,
    ),
    scopeValueCheck: check(
      'notification_subscriptions_scope_value_check',
      sql`(scope_type = 'global' AND scope_value IS NULL) OR (scope_type <> 'global' AND scope_value IS NOT NULL)`,
    ),
  }),
);

export const dropEventsRelations = relations(dropEvents, ({ one, many }) => ({
  sneaker: one(sneakers, {
    fields: [dropEvents.sneakerId],
    references: [sneakers.id],
  }),
  newsItems: many(newsItems),
}));

export const newsItemsRelations = relations(newsItems, ({ one }) => ({
  dropEvent: one(dropEvents, {
    fields: [newsItems.dropEventId],
    references: [dropEvents.id],
  }),
}));

export const subscribersRelations = relations(subscribers, ({ many }) => ({
  pushSubscriptions: many(webPushSubscriptions),
  notificationSubscriptions: many(notificationSubscriptions),
}));

// ------------------------------------- day 13: scheduler + consumer monitoring
//
// See apps/api/drizzle/0007_drop_scheduler_monitoring.sql and
// apps/api/src/drops/README.md for the full reasoning.

export const dropSchedulerRuns = pgTable(
  'drop_scheduler_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    /** Rows actually flipped by this run's atomic UPDATE ... RETURNING. */
    flipped: integer('flipped').notNull(),
    durationMs: integer('duration_ms').notNull(),
    /** Set only when the tick's own query failed outright. */
    error: text('error'),
  },
  (t) => ({
    runAtIdx: index('drop_scheduler_runs_run_at_idx').on(t.runAt.desc()),
  }),
);

export const dropConsumerFailures = pgTable(
  'drop_consumer_failures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** e.g. 'news-feed-auto-post' — a slug, not an FK. */
    consumer: text('consumer').notNull(),
    dropEventId: uuid('drop_event_id').references(() => dropEvents.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    recentIdx: index('drop_consumer_failures_recent_idx').on(t.consumer, t.failedAt.desc()),
  }),
);

// -------------------------------------------------------------- day 16: auth
//
// See apps/api/drizzle/0008_auth.sql and drops/README.md's Day 16
// section for the full reasoning. Auth.js (NextAuth v5) in apps/web is
// the one thing that writes these tables in the app's normal operation
// — apps/api's own copy here exists for the reconciliation script
// (Day 16 task 3) and any future endpoint that needs to read a user.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  /** NULL for an OAuth-only account. bcrypt output — hashed in apps/web, never here. */
  passwordHash: text('password_hash'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  // totp_secret_encrypted (BYTEA, pgp_sym_encrypt'd) also exists
  // physically — not modeled here, same convention as sneakers'
  // search_vector: it's only ever touched through raw sql`` calls
  // (apps/web/src/lib/auth/totp.ts) that call pgcrypto functions
  // Drizzle's typed builder has no way to express inline.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // Day 17
  role: userRoleEnum('role').notNull().default('user'),
  displayName: text('display_name'),
  avatarSeed: text('avatar_seed')
    .notNull()
    .default(sql`gen_random_uuid()::text`),
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (t) => ({
    providerAccountUniq: uniqueIndex('accounts_provider_account_unique').on(t.provider, t.providerAccountId),
    userIdx: index('accounts_user_idx').on(t.userId),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// -------------------------------------------------- day 17: trust & safety
//
// See apps/api/drizzle/0009_trust_safety.sql and
// docs/trust-and-safety/README.md for the full reasoning.

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterUserId: uuid('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reportedEntityType: reportEntityTypeEnum('reported_entity_type').notNull(),
    /** Deliberately not an FK — see the migration's header comment. */
    reportedEntityId: uuid('reported_entity_id').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
  },
  (t) => ({
    pendingIdx: index('reports_pending_idx').on(t.createdAt).where(sql`${t.status} = 'pending'`),
    entityIdx: index('reports_entity_idx').on(t.reportedEntityType, t.reportedEntityId),
    reporterIdx: index('reports_reporter_idx').on(t.reporterUserId),
  }),
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockerUserId: uuid('blocker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: uuid('blocked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairUniq: uniqueIndex('user_blocks_pair_unique').on(t.blockerUserId, t.blockedUserId),
    blockedIdx: index('user_blocks_blocked_idx').on(t.blockedUserId),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  subscribers: many(subscribers),
  reportsFiled: many(reports, { relationName: 'reporter' }),
  blocksMade: many(userBlocks, { relationName: 'blocker' }),
}));
