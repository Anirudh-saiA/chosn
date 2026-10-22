-- Delivery time and store ratings, per retailer.
--
-- Delivery: each store publishes a shipping policy. The day ranges below are read from those pages (source URL
-- kept next to the numbers) and are the store's own estimate, not a guarantee for any one pincode.
-- Ratings: nullable on purpose. None of these stores publish product reviews that can be read programmatically
-- (checked: 0 of 60 sampled product pages had a single review) and the public review sites block automated access,
-- so nothing is filled in until a real, citable source is added. `rating_source` / `rating_url` say where a
-- value came from, so the page never shows an unexplained number.

ALTER TABLE retailers ADD COLUMN IF NOT EXISTS delivery_min_days    integer;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS delivery_max_days    integer;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS delivery_note        text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS delivery_source_url  text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS rating               numeric(2,1);
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS review_count         integer;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS rating_source        text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS rating_url           text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS rating_updated_at    timestamptz;

UPDATE retailers SET
  delivery_min_days   = 4,
  delivery_max_days   = 6,
  delivery_note       = 'Usually 4–6 days, most orders within 4. Tracking link follows dispatch.',
  delivery_source_url = 'https://www.superkicks.in/policies/shipping-policy'
WHERE slug = 'superkicks';

UPDATE retailers SET
  delivery_min_days   = 8,
  delivery_max_days   = 10,
  delivery_note       = 'Standard shipping 8–10 business days. Select products ship instantly (dispatched in 24–48 hours).',
  delivery_source_url = 'https://crepdogcrew.com/policies/shipping-policy'
WHERE slug = 'crepdog-crew';

UPDATE retailers SET
  delivery_min_days   = 3,
  delivery_max_days   = 6,
  delivery_note       = 'Dispatched in 1–2 working days, then usually 2–3 days to deliver (allow 3–4).',
  delivery_source_url = 'https://www.vegnonveg.com/shipping-information'
WHERE slug = 'vegnonveg';
