-- How to show a story's picture: a "product" shot (light uniform background) becomes a cut-out on a coloured panel, a "photo" fills its frame.
ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS image_style text CHECK (image_style IN ('product', 'photo')),
  ADD COLUMN IF NOT EXISTS image_ratio real;
