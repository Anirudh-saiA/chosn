-- Day 11: full-text search over the Sneaker catalog.
--
-- Postgres tsvector/GIN, not Elasticsearch or a dedicated search
-- service — the brief is explicit that reaching for one at 20-30
-- (currently 5) launch-catalog models would be premature, and this
-- indexes properly enough to stay fast into the hundreds.
--
-- GENERATED ALWAYS ... STORED rather than a trigger: the column
-- recomputes itself on every INSERT/UPDATE with no application code or
-- trigger function to keep in sync, and reads it like any other column.
--
-- Weighted: brand/model rank highest (A) — searching "dunk" should
-- surface the Dunk before a colorway that happens to mention it in
-- passing — silhouette/colorway next (B), style_code last (C) and in
-- the 'simple' text config specifically, because "DD1391-100" is a
-- product code, not English prose, and English stemming on it would be
-- actively wrong (e.g. treating "100" or hyphenated segments oddly).
--
-- colorway/silhouette go through replace('/', ' ') first: Postgres's
-- parser treats "White/Black" (no surrounding spaces, the standard
-- sneaker colorway convention) as one indivisible lexeme, so a search
-- for "black" alone silently misses every "White/Black" colorway —
-- confirmed by actually running that query, not assumed. Splitting the
-- slash into a space first makes it two lexemes, "white" and "black",
-- either of which matches on its own.
ALTER TABLE sneakers ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(model, '')), 'A') ||
    setweight(to_tsvector('english', replace(coalesce(silhouette, ''), '/', ' ')), 'B') ||
    setweight(to_tsvector('english', replace(coalesce(colorway, ''), '/', ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(style_code, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS sneakers_search_vector_idx ON sneakers USING GIN (search_vector);

-- Browse/filter reads by brand and by "does this sneaker have a
-- computed signal" constantly (task 3) — supports both without a seq
-- scan once the catalog is past a handful of rows.
CREATE INDEX IF NOT EXISTS sneakers_brand_idx ON sneakers (brand);
