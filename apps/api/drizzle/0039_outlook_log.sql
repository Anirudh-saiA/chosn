-- A nightly record of what the Buy now / Wait outlook said, and later what the price actually did. This is the training and checking data for
-- a future learned model, and the honest scorecard for the current one (scripts/log-outlook.ts, scripts/outlook-report.ts).
-- Logged: every shoe-size with 7+ days of price history, plus a fixed 1-in-50 sample of the rest.
CREATE TABLE IF NOT EXISTS outlook_log (
  id bigserial PRIMARY KEY,
  logged_on date NOT NULL,
  sneaker_variant_id uuid NOT NULL REFERENCES sneaker_variants(id) ON DELETE CASCADE,
  verdict text NOT NULL,
  score smallint NOT NULL,
  confidence text NOT NULL,
  price integer NOT NULL,
  history_days smallint NOT NULL,
  peer_drop_share real,
  features jsonb NOT NULL,
  -- outcomes, filled in later by the same job (best price over the following 14 / 30 days, from daily_best_prices)
  days_seen_14 smallint,
  min_price_14 integer,
  max_price_14 integer,
  fell_5pct_14 boolean,
  rose_5pct_14 boolean,
  resolved_14_at timestamptz,
  days_seen_30 smallint,
  min_price_30 integer,
  max_price_30 integer,
  fell_5pct_30 boolean,
  rose_5pct_30 boolean,
  resolved_30_at timestamptz,
  UNIQUE (logged_on, sneaker_variant_id)
);
CREATE INDEX IF NOT EXISTS outlook_log_open14_idx ON outlook_log (logged_on) WHERE resolved_14_at IS NULL;
CREATE INDEX IF NOT EXISTS outlook_log_open30_idx ON outlook_log (logged_on) WHERE resolved_30_at IS NULL;
