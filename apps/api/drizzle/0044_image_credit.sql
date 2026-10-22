-- Where a stored picture came from (shown on the drop page). Pictures fetched for upcoming drops live in data/media/releases and are
-- served by the API at /media/releases/<file> (scripts/fetch_drop_images.py).
ALTER TABLE sneakers ADD COLUMN IF NOT EXISTS image_credit text;
