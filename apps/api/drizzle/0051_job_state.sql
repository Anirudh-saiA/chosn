-- Where each background job got to, so the hourly market-intelligence refresh can do only what changed since its last good run
-- (founder card be-hourly-refresh). Additive and safe to re-run. Rollback: DROP TABLE job_state;
CREATE TABLE IF NOT EXISTS job_state (
  name        text PRIMARY KEY,
  -- When the last fully successful run STARTED (not finished): prices that arrive during a run are picked up by the next one.
  last_run_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  detail      jsonb
);

-- "Which prices were read since the last run" would otherwise scan every row of the month's partition (1.4 million and growing). Rows arrive in
-- time order, so a BRIN index on fetched_at (a few kilobytes per partition) answers it from a handful of pages. Also speeds the nightly import's changedSince query.
CREATE INDEX IF NOT EXISTS price_snapshots_fetched_at_brin ON price_snapshots USING brin (fetched_at);
-- Rollback: DROP INDEX price_snapshots_fetched_at_brin;
