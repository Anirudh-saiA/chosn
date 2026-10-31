-- Tracked shoes (founder, 1 Nov): the site shows only sneakers from the top brands that are on sale at 2 or more stores,
-- so every shoe a visitor sees can be compared. Hidden shoes stay in the database untouched.
-- Refreshed after every nightly run by src/scripts/refresh-tracked.ts. Additive and safe to re-run.
-- Rollback: ALTER TABLE sneakers DROP COLUMN tracked;
ALTER TABLE sneakers ADD COLUMN IF NOT EXISTS tracked boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS sneakers_tracked_idx ON sneakers (id) WHERE tracked;
UPDATE sneakers s SET tracked = (
  s.footwear_type = 'sneaker'
  AND lower(s.brand) IN ('nike','adidas','new balance','jordan','puma','converse','asics')
  AND s.id IN (
    SELECT v.sneaker_id FROM price_snapshots p JOIN sneaker_variants v ON v.id = p.sneaker_variant_id
    WHERE p.is_latest AND p.in_stock GROUP BY v.sneaker_id HAVING count(DISTINCT p.retailer_id) >= 2
  )
);
