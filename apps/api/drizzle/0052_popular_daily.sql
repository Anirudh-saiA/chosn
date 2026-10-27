-- Daily popularity per shoe (founder card be-popular-daily): how many people looked at a shoe and pressed Buy on each day.
-- Filled every night from offer_events by src/scripts/fill-popular-daily.ts (idempotent: re-running a day recomputes it).
-- Counts only; no visitor, no store, nothing personal. Additive and safe to re-run. Rollback: DROP TABLE popular_daily;
CREATE TABLE IF NOT EXISTS popular_daily (
  day        date    NOT NULL,
  style_code text    NOT NULL,
  views      integer NOT NULL DEFAULT 0,
  clicks     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, style_code)
);
CREATE INDEX IF NOT EXISTS popular_daily_style_idx ON popular_daily (style_code, day DESC);
