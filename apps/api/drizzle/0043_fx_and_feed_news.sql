-- Rupees everywhere: the existing fx_rates table (currency, rate_to_inr) now gets USD and GBP updated daily by scripts/update-fx.ts, so a drop
-- priced in dollars is shown in rupees with the original price kept. (Nothing to create here.)

-- News gathered automatically from other sites' public feeds (scripts/fetch-news-feeds.ts): a headline, a short excerpt and a link out.
-- external = true means it is not our own writing; the site links to the original instead of showing a page of our own.
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS external boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS news_items_external_url_idx ON news_items (source_url) WHERE external;
