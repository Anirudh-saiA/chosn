-- Day 9: the computation layer that turns price_snapshots into the
-- numbers the Market Intelligence card shows.
--
-- Three pieces:
--   1. fx_rates + effective_price_inr() — currency conversion happens
--      here, at read time, never by rewriting price_snapshots. Day 1
--      Assumption 02 (see awin.adapter.ts) is explicit that a stored
--      conversion silently goes stale with no way to recover what was
--      actually quoted, so the raw table stays untouched and every
--      comparison across retailers goes through this function instead.
--   2. daily_best_prices — one row per (variant, day): the cheapest
--      available effective price a buyer could actually get that day,
--      not an average of every offer from every retailer. The hourly
--      job upserts today's row; 30d/90d averages are then a cheap read
--      over this small table instead of a live aggregation over
--      months of raw snapshots.
--   3. market_summaries, extended — the single row per variant the
--      price page reads. Renamed best_price -> best_available_price to
--      match what the Day 9 brief actually calls it.

-- ---------------------------------------------------------- fx_rates

-- Static, manually-maintained — there is no live FX feed wired up today.
-- INR is the identity rate; every non-INR retailer needs a row here or
-- its offers are excluded from ranking rather than compared as if equal
-- (see effective_price_inr below). Currently only GBP is needed (END.
-- Clothing, via Awin) since every other v1 source quotes INR directly.
CREATE TABLE IF NOT EXISTS fx_rates (
  currency     TEXT PRIMARY KEY,
  rate_to_inr  NUMERIC(14, 6) NOT NULL,
  source       TEXT NOT NULL DEFAULT 'static',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO fx_rates (currency, rate_to_inr, source) VALUES
  ('INR', 1.000000,   'identity'),
  ('GBP', 108.000000, 'static-manual')
ON CONFLICT (currency) DO NOTHING;

-- STABLE (not IMMUTABLE): rate_to_inr can change if this table is
-- updated, and STABLE tells the planner it's safe to cache within one
-- query but not across queries indefinitely.
CREATE OR REPLACE FUNCTION fx_rate_to_inr(p_currency TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT rate_to_inr FROM fx_rates WHERE currency = upper(p_currency);
$$;

-- The one definition of "effective price" (Day 9 task 1): base price
-- plus shipping, in INR, so a cheap item with expensive shipping never
-- outranks a pricier one that ships free. Returns NULL — not a wrong
-- number — when the price is missing or the currency has no fx_rates
-- row, so a snapshot in an unconverted currency is excluded from
-- ranking rather than compared to INR offers as if the numbers meant
-- the same thing. Every query that ranks or averages prices calls this
-- function rather than reimplementing the arithmetic.
CREATE OR REPLACE FUNCTION effective_price_inr(p_price NUMERIC, p_shipping NUMERIC, p_currency TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN p_price IS NULL THEN NULL
      WHEN fx_rate_to_inr(p_currency) IS NULL THEN NULL
      ELSE (p_price + COALESCE(p_shipping, 0)) * fx_rate_to_inr(p_currency)
    END;
$$;

-- ------------------------------------------------------ daily_best_prices

-- One row per (variant, day): today's cheapest in-stock, non-stale
-- effective price across every retailer. The hourly job upserts today's
-- row on every run (safe — same day, same key); avg_30d/avg_90d then
-- read this table instead of aggregating raw price_snapshots live.
CREATE TABLE IF NOT EXISTS daily_best_prices (
  sneaker_variant_id  UUID NOT NULL REFERENCES sneaker_variants (id) ON DELETE CASCADE,
  day                 DATE NOT NULL,
  best_price_inr      NUMERIC(14, 2) NOT NULL,
  best_retailer_id    UUID REFERENCES retailers (id) ON DELETE SET NULL,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sneaker_variant_id, day)
);

CREATE INDEX IF NOT EXISTS daily_best_prices_variant_day_idx
  ON daily_best_prices (sneaker_variant_id, day DESC);

-- ------------------------------------------------------- market_summaries

-- Day 6 stubbed this table anticipating exactly this feature. Renamed to
-- match the column name the Day 9 brief specifies.
ALTER TABLE market_summaries RENAME COLUMN best_price TO best_available_price;

ALTER TABLE market_summaries
  -- current_price's retailer, so "View Deal" has somewhere to send the
  -- click even when that offer isn't the cheapest one (see the service
  -- doc comment on why current_price and best_available_price can differ).
  ADD COLUMN IF NOT EXISTS current_retailer_id   UUID REFERENCES retailers (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_retailer_slug TEXT,
  ADD COLUMN IF NOT EXISTS best_retailer_slug     TEXT,
  -- How many real days of daily_best_prices fed avg_30d/avg_90d. A page
  -- launched last week has no 90 real days yet — this says so instead of
  -- quietly averaging over 4 days and presenting it as a 90-day figure.
  ADD COLUMN IF NOT EXISTS days_history_30d       SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_history_90d       SMALLINT NOT NULL DEFAULT 0,
  -- False until days_history_30d clears MIN_DAYS_FOR_SIGNAL (service
  -- constant) — the frontend's cue to show "gathering data" instead of a
  -- trend claim backed by one or two data points.
  ADD COLUMN IF NOT EXISTS sufficient_data        BOOLEAN NOT NULL DEFAULT false,
  -- Every monetary column on this table is INR after effective_price_inr
  -- conversion — recorded explicitly rather than left implicit, since
  -- price_snapshots itself deliberately is NOT all INR.
  ADD COLUMN IF NOT EXISTS currency               TEXT NOT NULL DEFAULT 'INR';

ALTER TABLE market_summaries
  ADD CONSTRAINT market_summaries_signal_check
  CHECK (signal IS NULL OR signal IN ('good_time_to_buy', 'neutral', 'consider_waiting', 'insufficient_data'));
