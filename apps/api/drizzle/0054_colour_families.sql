-- Colour families grow from 12 to 20 (silver, gold, navy, maroon, cream, olive, teal, multi; catalog-filters.ts).
-- Rebuilds catalog_colors_mv with the new lists. Same shape as 0050 (real sneakers only); safe to re-run: it does nothing once the view has 'multi'.
-- Rollback: re-run the CREATE in 0050_footwear_type.sql.
DO $mv$
BEGIN
  IF pg_get_viewdef('catalog_colors_mv'::regclass) NOT LIKE '%THEN ''multi''%' THEN
    DROP MATERIALIZED VIEW catalog_colors_mv;
    CREATE MATERIALIZED VIEW catalog_colors_mv AS
      SELECT s.id AS sneaker_id,
      array_remove(ARRAY[
        CASE WHEN lower(s.colorway) ~ '\m(black|noir|onyx|jet|obsidian)\M' THEN 'black' END,
        CASE WHEN lower(s.colorway) ~ '\m(white|sail|summit|pearl|phantom)\M' THEN 'white' END,
        CASE WHEN lower(s.colorway) ~ '\m(cream|ivory|coconut milk|bone|chalk)\M' THEN 'cream' END,
        CASE WHEN lower(s.colorway) ~ '\m(grey|gray|smoke|slate|charcoal|graphite|concrete|cement|fog|iron)\M' THEN 'grey' END,
        CASE WHEN lower(s.colorway) ~ '\m(silver|platinum)\M' THEN 'silver' END,
        CASE WHEN lower(s.colorway) ~ '\m(brown|mocha|chocolate|cacao|espresso|coffee|russet|baroque|cinnamon|bronze)\M' THEN 'brown' END,
        CASE WHEN lower(s.colorway) ~ '\m(beige|sand|tan|khaki|oat|oatmeal|stone|taupe|camel|wheat|linen|birch|natural|gum)\M' THEN 'beige' END,
        CASE WHEN lower(s.colorway) ~ '\m(red|crimson|scarlet|infrared|cherry|bred|cardinal)\M' THEN 'red' END,
        CASE WHEN lower(s.colorway) ~ '\m(maroon|burgundy|wine)\M' THEN 'maroon' END,
        CASE WHEN lower(s.colorway) ~ '\m(orange|amber|rust|coral|ember|sunset)\M' THEN 'orange' END,
        CASE WHEN lower(s.colorway) ~ '\m(yellow|lemon|citrus|mustard|curry|butter|lime)\M' THEN 'yellow' END,
        CASE WHEN lower(s.colorway) ~ '\m(gold)\M' THEN 'gold' END,
        CASE WHEN lower(s.colorway) ~ '\m(green|mint|volt|spruce|forest|emerald|fir)\M' THEN 'green' END,
        CASE WHEN lower(s.colorway) ~ '\m(olive|sage|moss)\M' THEN 'olive' END,
        CASE WHEN lower(s.colorway) ~ '\m(teal|jade)\M' THEN 'teal' END,
        CASE WHEN lower(s.colorway) ~ '\m(blue|royal|indigo|denim|cobalt|sky|aqua|marine)\M' THEN 'blue' END,
        CASE WHEN lower(s.colorway) ~ '\m(navy|midnight)\M' THEN 'navy' END,
        CASE WHEN lower(s.colorway) ~ '\m(purple|violet|lilac|lavender|plum|mauve|thistle|grape|orchid)\M' THEN 'purple' END,
        CASE WHEN lower(s.colorway) ~ '\m(pink|rose|blush|magenta|fuchsia|rosewood|salmon)\M' THEN 'pink' END,
        CASE WHEN lower(s.colorway) ~ '\m(multi|multicolor|multicolour|multicolored)\M' THEN 'multi' END
      ], NULL) AS families
      FROM sneakers s
      WHERE s.footwear_type = 'sneaker';
    CREATE UNIQUE INDEX catalog_colors_mv_pk ON catalog_colors_mv (sneaker_id);
  END IF;
END $mv$;
