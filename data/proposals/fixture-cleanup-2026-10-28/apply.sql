-- Local dev DB only (chosn_dev). Run: docker exec -i chosn-postgres-1 psql -U postgres -d chosn_dev -v ON_ERROR_STOP=1 < apply.sql
-- 1) FIXTURE rows stop being current. 2) Rebuild daily_best_prices (90 days, as-of join as in backfill-daily-best-prices.ts)
--    for the variants that have FIXTURE rows, ignoring FIXTURE rows. Backups: *_before.csv in this folder. Undo: undo.sql.
BEGIN;
CREATE TEMP TABLE fx_variants ON COMMIT DROP AS
  SELECT DISTINCT sneaker_variant_id AS id FROM price_snapshots WHERE listing_url LIKE '%FIXTURE%';

UPDATE price_snapshots SET is_latest = false WHERE listing_url LIKE '%FIXTURE%' AND is_latest;

DELETE FROM daily_best_prices WHERE sneaker_variant_id IN (SELECT id FROM fx_variants);

INSERT INTO daily_best_prices (sneaker_variant_id, day, best_price_inr, best_retailer_id, computed_at)
SELECT v.id, d.day, b.price_inr, b.retailer_id, now()
FROM sneaker_variants v
JOIN fx_variants fx ON fx.id = v.id
JOIN sneakers s ON s.id = v.sneaker_id
CROSS JOIN LATERAL generate_series(
  GREATEST((SELECT MIN(fetched_at)::date FROM price_snapshots), CURRENT_DATE - INTERVAL '89 days'),
  CURRENT_DATE, INTERVAL '1 day') AS d(day)
CROSS JOIN LATERAL (
  SELECT effective_price_inr(latest.price, latest.shipping_cost, latest.currency) AS price_inr, latest.retailer_id
  FROM (
    SELECT DISTINCT ON (ps.retailer_id) ps.retailer_id, ps.price, ps.shipping_cost, ps.currency, ps.in_stock, ps.fetched_at,
           r.fetch_frequency_minutes
    FROM price_snapshots ps JOIN retailers r ON r.id = ps.retailer_id
    WHERE ps.sneaker_variant_id = v.id AND ps.fetched_at <= d.day + INTERVAL '1 day'
      AND ps.listing_url NOT LIKE '%FIXTURE%'
    ORDER BY ps.retailer_id, ps.fetched_at DESC
  ) latest
  WHERE latest.in_stock = true
    AND latest.fetched_at > (d.day + INTERVAL '1 day') - (latest.fetch_frequency_minutes * 2 || ' minutes')::interval
    AND effective_price_inr(latest.price, latest.shipping_cost, latest.currency) IS NOT NULL
  ORDER BY price_inr ASC LIMIT 1
) b
WHERE EXISTS (SELECT 1 FROM retailer_product_mappings rpm WHERE rpm.sneaker_id = s.id);

SELECT (SELECT count(*) FROM price_snapshots WHERE listing_url LIKE '%FIXTURE%' AND is_latest) AS fixture_latest_after,
       (SELECT count(*) FROM daily_best_prices WHERE sneaker_variant_id IN (SELECT id FROM fx_variants)) AS dbp_rows_after;
COMMIT;
