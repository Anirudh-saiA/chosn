-- Myntra becomes a real, scraped store (prices read from its own listing pages by scripts/scrape_myntra_prices.py),
-- and CHOSN can now show a shoe's rating at the stores that publish one.
--
--   retailer_product_ratings: one row per (shoe, store) with the store's own rating and rating count for that shoe,
--   copied as shown (Myntra's listing pages carry them). A shoe a store shows no rating for simply has no row: no
--   rating is ever filled in.

CREATE TABLE IF NOT EXISTS retailer_product_ratings (
  sneaker_id   uuid NOT NULL REFERENCES sneakers (id) ON DELETE CASCADE,
  retailer_id  uuid NOT NULL REFERENCES retailers (id) ON DELETE CASCADE,
  rating       numeric(3, 2) NOT NULL,
  rating_count integer NOT NULL,
  source_url   text,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sneaker_id, retailer_id)
);

-- Myntra: facts from https://www.myntra.com/faqs and /returns (read 17 Oct 2026).
UPDATE retailers SET
  integration_type = 'manual',
  logo_url         = '/stores/myntra.png',
  delivery_note    = 'Varies by pincode. Myntra shows the delivery date only after you enter a pincode.',
  returns_note     = 'Return or exchange within 14 days of receiving your order',
  returns_tone     = 'ok',
  info_source_url  = 'https://www.myntra.com/faqs'
WHERE slug = 'myntra';

-- The placeholder (demo) Myntra prices are replaced by the real ones.
DELETE FROM price_snapshots
 WHERE retailer_id = (SELECT id FROM retailers WHERE slug = 'myntra') AND listing_url LIKE '%FIXTURE%';
