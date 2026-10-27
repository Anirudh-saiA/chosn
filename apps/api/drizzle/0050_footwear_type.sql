-- Footwear type (founder card be-footwear-type, answer "hide"): slides, sandals and boots/other are hidden from every public read.
-- Additive and safe to re-run. No rows are deleted. Rollback at the bottom.
-- Why not reuse sneakers.category? It is a sport enum (basketball/lifestyle/running/skate) and 42,608 of 42,636 rows are NULL.

DO $$ BEGIN
  CREATE TYPE footwear_type AS ENUM ('sneaker', 'slide', 'sandal', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One definition of the rule, in the database, so the API, the importers and the backfill cannot disagree.
-- (apps/api/src/catalog/footwear-type.ts mirrors these exact patterns for tests; footwear-type.spec.ts fails if they drift.)
-- Word boundaries (\m \M) so "Landslide" is not a slide. Anything that says "sneaker" stays a sneaker ("Slide Sneaker", "Sneaker Mule").
-- Anything unsure stays 'sneaker': hiding a real sneaker is worse than showing one odd sandal.
CREATE OR REPLACE FUNCTION classify_footwear(p_model text, p_silhouette text) RETURNS footwear_type
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT CASE
    WHEN t ~* '\msneakers?\M' THEN 'sneaker'::footwear_type
    WHEN t ~* '\m(sandals?|sandalen|gladiators?)\M' THEN 'sandal'::footwear_type
    WHEN t ~* '\m(flip[ -]?flops?|slides?|sliders?|slippers?|thongs?|floaters?|mules?|clogs?|adilette)\M' THEN 'slide'::footwear_type
    WHEN t ~* '\m(boots?|loafers?|derby|chukkas?|heels?|socks?|bags?|backpacks?|hats?|shirts?|hoodies?|jackets?|shorts)\M' THEN 'other'::footwear_type
    ELSE 'sneaker'::footwear_type
  END
  FROM (SELECT coalesce(p_model, '') || ' ' || coalesce(p_silhouette, '') AS t) x
$f$;

ALTER TABLE sneakers ADD COLUMN IF NOT EXISTS footwear_type footwear_type;
ALTER TABLE sneakers ADD COLUMN IF NOT EXISTS footwear_type_manual boolean NOT NULL DEFAULT false; -- true = a person set it; the rule never overrides

-- New rows and renamed rows classify themselves, so the importers need no change.
CREATE OR REPLACE FUNCTION sneakers_set_footwear_type() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.footwear_type IS NULL OR (NOT NEW.footwear_type_manual AND (TG_OP = 'INSERT' OR NEW.model IS DISTINCT FROM OLD.model OR NEW.silhouette IS DISTINCT FROM OLD.silhouette)) THEN
    NEW.footwear_type := classify_footwear(NEW.model, NEW.silhouette);
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS sneakers_footwear_type_trg ON sneakers;
CREATE TRIGGER sneakers_footwear_type_trg BEFORE INSERT OR UPDATE OF model, silhouette, footwear_type ON sneakers
  FOR EACH ROW EXECUTE FUNCTION sneakers_set_footwear_type();

-- Old rows. ~42.6k rows, one pass. Never touches a row a person set.
UPDATE sneakers SET footwear_type = classify_footwear(model, silhouette) WHERE footwear_type IS NULL;

ALTER TABLE sneakers ALTER COLUMN footwear_type SET DEFAULT 'sneaker';
ALTER TABLE sneakers ALTER COLUMN footwear_type SET NOT NULL;
CREATE INDEX IF NOT EXISTS sneakers_footwear_type_idx ON sneakers (footwear_type) WHERE footwear_type <> 'sneaker';

-- The three catalog views leave non-sneakers out, so browse, search, the budget shelf, store totals and facets never see them.
-- A materialized view cannot be altered, so each is rebuilt once; the guard makes a second run a no-op.
-- The API refreshes them with REFRESH ... CONCURRENTLY, which needs the unique indexes recreated here.
DO $mv$
BEGIN
  IF pg_get_viewdef('catalog_default_variant_mv'::regclass) NOT LIKE '%footwear_type%' THEN
    DROP MATERIALIZED VIEW catalog_default_variant_mv;
    CREATE MATERIALIZED VIEW catalog_default_variant_mv AS
      SELECT DISTINCT ON (v.sneaker_id) v.sneaker_id, v.id AS variant_id, v.size, v.size_system
      FROM sneaker_variants v
      JOIN sneakers s ON s.id = v.sneaker_id AND s.footwear_type = 'sneaker'
      LEFT JOIN market_summaries mv ON mv.sneaker_variant_id = v.id
      ORDER BY v.sneaker_id, (mv.best_available_price IS NULL), mv.best_available_price ASC, v.size ASC;
    CREATE UNIQUE INDEX catalog_default_variant_mv_pk ON catalog_default_variant_mv (sneaker_id);
  END IF;

  IF pg_get_viewdef('catalog_stats_mv'::regclass) NOT LIKE '%footwear_type%' THEN
    DROP MATERIALIZED VIEW catalog_stats_mv;
    CREATE MATERIALIZED VIEW catalog_stats_mv AS
      WITH real_offers AS (
        SELECT v.sneaker_id, v.size, v.size_system, ps.retailer_id, r.slug,
               effective_price_inr(ps.price, ps.shipping_cost, ps.currency) AS price
        FROM price_snapshots ps
        JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
        JOIN sneakers sn ON sn.id = v.sneaker_id AND sn.footwear_type = 'sneaker'
        JOIN retailers r ON r.id = ps.retailer_id
        WHERE ps.is_latest = true AND ps.in_stock = true AND ps.listing_url NOT LIKE '%FIXTURE%'
      )
      SELECT sneaker_id,
             count(DISTINCT retailer_id) AS store_count,
             array_agg(DISTINCT slug) AS store_slugs,
             min(price) AS min_price,
             (array_agg(size ORDER BY price))[1] AS min_size,
             (array_agg(size_system ORDER BY price))[1] AS min_size_system
      FROM real_offers
      GROUP BY sneaker_id;
    CREATE UNIQUE INDEX catalog_stats_mv_pk ON catalog_stats_mv (sneaker_id);
  END IF;

  IF pg_get_viewdef('catalog_colors_mv'::regclass) NOT LIKE '%footwear_type%' THEN
    DROP MATERIALIZED VIEW catalog_colors_mv;
    CREATE MATERIALIZED VIEW catalog_colors_mv AS
      SELECT s.id AS sneaker_id,
      array_remove(ARRAY[
        CASE WHEN lower(s.colorway) ~ '\m(black|noir|onyx|jet|obsidian)\M' THEN 'black' END,
        CASE WHEN lower(s.colorway) ~ '\m(white|sail|ivory|cream|coconut milk|summit|bone|pearl|phantom|chalk)\M' THEN 'white' END,
        CASE WHEN lower(s.colorway) ~ '\m(grey|gray|silver|smoke|slate|charcoal|graphite|concrete|cement|fog|iron|platinum)\M' THEN 'grey' END,
        CASE WHEN lower(s.colorway) ~ '\m(brown|mocha|chocolate|cacao|espresso|coffee|russet|baroque|cinnamon|bronze)\M' THEN 'brown' END,
        CASE WHEN lower(s.colorway) ~ '\m(beige|sand|tan|khaki|oat|oatmeal|stone|taupe|camel|wheat|linen|birch|natural|gum)\M' THEN 'beige' END,
        CASE WHEN lower(s.colorway) ~ '\m(red|crimson|burgundy|maroon|scarlet|infrared|cherry|bred|wine|cardinal)\M' THEN 'red' END,
        CASE WHEN lower(s.colorway) ~ '\m(orange|amber|rust|coral|ember|sunset)\M' THEN 'orange' END,
        CASE WHEN lower(s.colorway) ~ '\m(yellow|gold|lemon|citrus|mustard|curry|butter|lime)\M' THEN 'yellow' END,
        CASE WHEN lower(s.colorway) ~ '\m(green|olive|sage|mint|volt|spruce|forest|emerald|teal|jade|moss|fir)\M' THEN 'green' END,
        CASE WHEN lower(s.colorway) ~ '\m(blue|navy|royal|indigo|denim|cobalt|sky|aqua|marine|midnight)\M' THEN 'blue' END,
        CASE WHEN lower(s.colorway) ~ '\m(purple|violet|lilac|lavender|plum|mauve|thistle|grape|orchid)\M' THEN 'purple' END,
        CASE WHEN lower(s.colorway) ~ '\m(pink|rose|blush|magenta|fuchsia|rosewood|salmon)\M' THEN 'pink' END
      ], NULL) AS families
      FROM sneakers s
      WHERE s.footwear_type = 'sneaker';
    CREATE UNIQUE INDEX catalog_colors_mv_pk ON catalog_colors_mv (sneaker_id);
  END IF;
END $mv$;

-- To show a hidden shoe again (a person's call, survives re-imports): UPDATE sneakers SET footwear_type = 'sneaker', footwear_type_manual = true WHERE style_code = '...';
-- then refresh the views (the API does it after every import, or: REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_stats_mv; and the other two).
-- ROLLBACK (loses only the new column; rebuild the three views from 0026/0027 without the sneakers join if the hidden shoes should return):
--   DROP MATERIALIZED VIEW catalog_colors_mv, catalog_stats_mv, catalog_default_variant_mv;  -- then re-run the CREATE statements in 0026 and 0027
--   DROP TRIGGER sneakers_footwear_type_trg ON sneakers; DROP FUNCTION sneakers_set_footwear_type();
--   DROP INDEX sneakers_footwear_type_idx; ALTER TABLE sneakers DROP COLUMN footwear_type, DROP COLUMN footwear_type_manual;
--   DROP FUNCTION classify_footwear(text, text); DROP TYPE footwear_type;
--   DELETE FROM _migrations WHERE name = '0050_footwear_type.sql';
