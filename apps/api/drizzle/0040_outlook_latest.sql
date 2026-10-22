-- Today's Buy now / Wait verdict for every in-stock shoe-size (one row each), refreshed by scripts/log-outlook.ts after each import.
-- The Compare list reads it to show a verdict on each card and to filter and sort by it. outlook_log keeps the history; this is the latest.
CREATE TABLE IF NOT EXISTS outlook_latest (
  sneaker_variant_id uuid PRIMARY KEY REFERENCES sneaker_variants(id) ON DELETE CASCADE,
  computed_on date NOT NULL,
  verdict text NOT NULL,
  score smallint NOT NULL,
  confidence text NOT NULL
);
CREATE INDEX IF NOT EXISTS outlook_latest_verdict_idx ON outlook_latest (verdict, score DESC);
