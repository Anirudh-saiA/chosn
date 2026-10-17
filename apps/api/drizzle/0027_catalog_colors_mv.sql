-- Which colour families (catalog-filters.ts) each shoe belongs to, worked out once per import instead of 12 regex
-- matches per shoe on every browse request. Refreshed with the other catalog views (MarketIntelligenceService.refreshCatalogViews).

CREATE MATERIALIZED VIEW IF NOT EXISTS catalog_colors_mv AS
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
  FROM sneakers s;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_colors_mv_pk ON catalog_colors_mv (sneaker_id);
