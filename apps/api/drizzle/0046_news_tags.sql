-- News: brand and category tags, an India flag, a near-duplicate pointer, and the shoe a story is about (a search query for Compare).
ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS brands text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('release', 'collab', 'culture', 'industry')),
  ADD COLUMN IF NOT EXISTS india boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dup_of uuid REFERENCES news_items (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shoe_query text,
  ADD COLUMN IF NOT EXISTS tagged_at timestamptz;

CREATE INDEX IF NOT EXISTS news_items_category_idx ON news_items (category) WHERE dup_of IS NULL;
CREATE INDEX IF NOT EXISTS news_items_brands_idx ON news_items USING gin (brands);
