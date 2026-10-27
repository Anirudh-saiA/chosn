-- Step 2: mark Mainstreet Marketplace and Culture Circle snapshots as resale. Run only after 01_backup.sh and after reading this.
--   docker exec -i chosn-postgres-1 psql -U postgres -d chosn_dev -X -v ON_ERROR_STOP=1 < 02_update.sql
-- One transaction; it rolls back by itself if the count is not what the backup holds. Nothing else is touched:
-- only price_snapshots.price_type for these two stores. No price, stock, date or is_latest value changes.
BEGIN;
CREATE TEMP TABLE before_count AS
  SELECT count(*) AS n FROM price_snapshots s JOIN retailers r ON r.id = s.retailer_id
  WHERE r.slug IN ('mainstreet-marketplace','culture-circle') AND s.price_type <> 'resale';
SELECT n AS rows_to_change FROM before_count;
UPDATE price_snapshots s SET price_type = 'resale'
  FROM retailers r
  WHERE r.id = s.retailer_id AND r.slug IN ('mainstreet-marketplace','culture-circle') AND s.price_type <> 'resale';
-- must be zero left and nothing outside the two stores changed
DO $$
DECLARE left_over bigint; other_resale bigint;
BEGIN
  SELECT count(*) INTO left_over FROM price_snapshots s JOIN retailers r ON r.id = s.retailer_id
    WHERE r.slug IN ('mainstreet-marketplace','culture-circle') AND s.price_type <> 'resale';
  SELECT count(*) INTO other_resale FROM price_snapshots s JOIN retailers r ON r.id = s.retailer_id
    WHERE r.slug NOT IN ('mainstreet-marketplace','culture-circle') AND s.price_type <> 'retail';
  IF left_over <> 0 OR other_resale <> 0 THEN RAISE EXCEPTION 'unexpected state: left_over=%, other_non_retail=%', left_over, other_resale; END IF;
END $$;
-- If rows_to_change above differs from the backup file's row count, type ROLLBACK; instead of COMMIT; (this script stops here when run with -c).
COMMIT;
SELECT r.slug, s.price_type, count(*) FROM price_snapshots s JOIN retailers r ON r.id = s.retailer_id
  WHERE r.slug IN ('mainstreet-marketplace','culture-circle') GROUP BY 1, 2 ORDER BY 1, 2;
