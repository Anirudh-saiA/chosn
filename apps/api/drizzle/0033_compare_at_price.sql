-- The store's own "was" price for a listing (Shopify's compare_at_price), saved next to the price. It is what the store itself shows
-- as the original price, so the site can list the biggest store-stated discounts. NULL when the store gives none (or it is not
-- higher than the price). Added on the partitioned parent, so every partition gets it.
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS compare_at_price numeric(12, 2);
CREATE INDEX IF NOT EXISTS price_snapshots_deals_idx ON price_snapshots (sneaker_variant_id) WHERE is_latest AND compare_at_price IS NOT NULL;
