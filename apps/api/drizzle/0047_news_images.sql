-- A picture for each story, kept on our own server (data/media/news) with a credit line.
ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_credit text;
