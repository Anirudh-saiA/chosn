-- Undo apply.sql (local dev DB only). Run from this folder:
--   docker cp fixture_is_latest_rows_before.csv chosn-postgres-1:/tmp/
--   docker cp daily_best_prices_affected_before.csv chosn-postgres-1:/tmp/
--   docker exec -i chosn-postgres-1 psql -U postgres -d chosn_dev -v ON_ERROR_STOP=1 < undo.sql
BEGIN;
CREATE TEMP TABLE bk_ids (id uuid, fetched_at timestamptz) ON COMMIT DROP;
COPY bk_ids FROM '/tmp/fixture_is_latest_rows_before.csv' WITH CSV HEADER;
UPDATE price_snapshots ps SET is_latest = true FROM bk_ids b WHERE ps.id = b.id AND ps.fetched_at = b.fetched_at;
CREATE TEMP TABLE bk_dbp (LIKE daily_best_prices) ON COMMIT DROP;
COPY bk_dbp FROM '/tmp/daily_best_prices_affected_before.csv' WITH CSV HEADER;
DELETE FROM daily_best_prices WHERE sneaker_variant_id IN (SELECT DISTINCT sneaker_variant_id FROM price_snapshots WHERE listing_url LIKE '%FIXTURE%');
INSERT INTO daily_best_prices SELECT * FROM bk_dbp;
SELECT (SELECT count(*) FROM price_snapshots WHERE listing_url LIKE '%FIXTURE%' AND is_latest) AS fixture_latest_restored,
       (SELECT count(*) FROM bk_dbp) AS dbp_rows_restored;
COMMIT;
