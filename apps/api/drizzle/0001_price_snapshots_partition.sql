-- price_snapshots: the fastest-growing table in the system.
--
-- PARTITIONING DECISION: native declarative RANGE partitioning by month
-- on fetched_at, NOT TimescaleDB.
--
-- TimescaleDB would be the better tool — continuous aggregates would suit
-- MarketSummary almost exactly — but it isn't available: both the local
-- container and Railway's Postgres run the stock postgres:16 image, which
-- ships no timescaledb extension (verified against pg_available_extensions,
-- not assumed). Adopting it would mean migrating the database to a
-- different image on a Hobby plan already limited to one volume.
--
-- Monthly (not daily/weekly) because the Day 1 cadence table puts retail
-- sources at 12–24h and resale at 1–4h. Ten sources x ~300 variants at the
-- fastest cadence is on the order of 2M rows/month — comfortably within a
-- single partition, while still letting old months be detached or dropped
-- as one cheap DDL statement instead of a bulk DELETE.

CREATE TABLE IF NOT EXISTS price_snapshots (
  id                     UUID NOT NULL DEFAULT gen_random_uuid(),
  sneaker_variant_id     UUID NOT NULL REFERENCES sneaker_variants (id) ON DELETE CASCADE,
  retailer_id            UUID NOT NULL REFERENCES retailers (id) ON DELETE RESTRICT,
  price                  NUMERIC(12, 2) NOT NULL,
  shipping_cost          NUMERIC(12, 2),
  currency               TEXT NOT NULL,
  condition              condition NOT NULL DEFAULT 'new',
  price_type             price_type NOT NULL,
  in_stock               BOOLEAN NOT NULL,
  listing_url            TEXT NOT NULL,
  authenticity_verified  BOOLEAN NOT NULL DEFAULT false,
  is_latest              BOOLEAN NOT NULL DEFAULT true,
  fetched_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A partitioned table's primary key must contain the partition key, so
  -- this is (id, fetched_at) rather than (id) alone. id stays globally
  -- unique in practice via gen_random_uuid().
  PRIMARY KEY (id, fetched_at)
) PARTITION BY RANGE (fetched_at);

-- THE index the Day 6 brief calls out: every price page asks "this
-- variant's history, newest first." Declared on the partitioned parent,
-- so Postgres creates and maintains a matching local index on every
-- partition, including ones created later.
CREATE INDEX IF NOT EXISTS price_snapshots_variant_fetched_idx
  ON price_snapshots (sneaker_variant_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS price_snapshots_retailer_idx
  ON price_snapshots (retailer_id);

-- Partial index for "what does this cost right now" — the comparison grid
-- reads current prices far more often than history, and this keeps that
-- lookup off the history index entirely.
CREATE INDEX IF NOT EXISTS price_snapshots_latest_idx
  ON price_snapshots (sneaker_variant_id, retailer_id)
  WHERE is_latest;

/**
 * Creates the monthly partition covering `target`, if it doesn't exist.
 * Idempotent, so boot can call it unconditionally.
 */
CREATE OR REPLACE FUNCTION ensure_price_snapshot_partition(target DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  start_bound DATE := date_trunc('month', target)::DATE;
  end_bound   DATE := (date_trunc('month', target) + INTERVAL '1 month')::DATE;
  part_name   TEXT := 'price_snapshots_' || to_char(start_bound, 'YYYY_MM');
BEGIN
  IF to_regclass(part_name) IS NOT NULL THEN
    RETURN part_name || ' (exists)';
  END IF;

  EXECUTE format(
    'CREATE TABLE %I PARTITION OF price_snapshots FOR VALUES FROM (%L) TO (%L)',
    part_name, start_bound, end_bound
  );

  RETURN part_name || ' (created)';
END;
$$;

-- Backstop so a write can never fail for want of a partition. Boot creates
-- the current and next month ahead of time, so this should stay empty —
-- which matters, because attaching a new partition has to scan the default
-- one, and that scan is only cheap while it holds no rows.
CREATE TABLE IF NOT EXISTS price_snapshots_default
  PARTITION OF price_snapshots DEFAULT;

SELECT ensure_price_snapshot_partition(CURRENT_DATE);
SELECT ensure_price_snapshot_partition((CURRENT_DATE + INTERVAL '1 month')::DATE);
