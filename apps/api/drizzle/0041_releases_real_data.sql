-- Releases: real data only on the public site.
--  * drop_events / news_items get an is_demo flag. Every row that exists when this runs is seed or test data (seed-demo-drops, scheduler
--    tests), so it is flagged and hidden from public lists unless SHOW_DEMO_RELEASES=1 (local development).
--  * drop_events gets the source a drop was confirmed by. Drops are entered with a source (scripts/import-drops.ts), never as rumours.
--  * listing_first_seen records the first day each store listed each shoe, for the "Just landed" feed. Rows written on a store's first day
--    are a baseline (is_baseline), not new arrivals, so onboarding a store does not look like a release.
ALTER TABLE drop_events ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE drop_events ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE drop_events ADD COLUMN IF NOT EXISTS source_url text;
UPDATE drop_events SET is_demo = true;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
UPDATE news_items SET is_demo = true;

CREATE TABLE IF NOT EXISTS listing_first_seen (
  sneaker_id uuid NOT NULL REFERENCES sneakers(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  first_seen date NOT NULL,
  is_baseline boolean NOT NULL DEFAULT false,
  PRIMARY KEY (sneaker_id, retailer_id)
);
CREATE INDEX IF NOT EXISTS listing_first_seen_new_idx ON listing_first_seen (first_seen DESC) WHERE NOT is_baseline;
