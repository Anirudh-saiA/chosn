-- The browse / search page needs, for every shoe, its cheapest in-stock price, how many stores have it and which size that
-- price is for. With about 40,000 shoes and 460,000 live prices, working that out on every request took 5 to 10 seconds.
-- These two materialized views hold the answer; they are refreshed at the end of every price import
-- (MarketIntelligenceService.refreshAll), which is the only time the prices change.

CREATE MATERIALIZED VIEW IF NOT EXISTS catalog_default_variant_mv AS
  -- The variant whose market summary (signal) a card shows; the smallest size when none has a price.
  SELECT DISTINCT ON (v.sneaker_id) v.sneaker_id, v.id AS variant_id, v.size, v.size_system
  FROM sneaker_variants v
  LEFT JOIN market_summaries mv ON mv.sneaker_variant_id = v.id
  ORDER BY v.sneaker_id, (mv.best_available_price IS NULL), mv.best_available_price ASC, v.size ASC;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_default_variant_mv_pk ON catalog_default_variant_mv (sneaker_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS catalog_stats_mv AS
  WITH real_offers AS (
    -- latest in-stock listings with a real link (the demo fixtures are left out)
    SELECT v.sneaker_id, v.size, v.size_system, ps.retailer_id, r.slug,
           effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price
    FROM price_snapshots ps
    JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
    JOIN retailers r ON r.id = ps.retailer_id
    WHERE ps.is_latest = true AND ps.in_stock = true AND ps.listing_url NOT LIKE '%FIXTURE%'
  )
  SELECT sneaker_id,
         count(DISTINCT retailer_id) AS store_count,
         array_agg(DISTINCT slug) AS store_slugs,
         min(price) AS min_price,
         (array_agg(size ORDER BY price))[1] AS min_size,
         (array_agg(size_system ORDER BY price))[1] AS min_size_system
  FROM real_offers
  GROUP BY sneaker_id;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_stats_mv_pk ON catalog_stats_mv (sneaker_id);
