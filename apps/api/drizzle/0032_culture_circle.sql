-- Culture Circle (https://www.culture-circle.com): an authenticated-resale marketplace. Its robots.txt allows the product pages
-- (it disallows /api/ and checkout). The facts below are what its own product pages state in their structured data
-- (read 19 Oct 2026): handling 1-3 days + transit 2-5 days, free shipping, free returns within 7 days by mail.
-- Its product pages are read a chunk at a time and carried forward for up to 14 days, so a price can be up to that old.

INSERT INTO retailers (name, slug, base_url, integration_type, region_focus, status, logo_url,
                       delivery_min_days, delivery_max_days, delivery_note, delivery_source_url,
                       returns_note, returns_tone, shipping_note, info_source_url, fetch_frequency_minutes)
VALUES ('Culture Circle', 'culture-circle', 'https://www.culture-circle.com', 'manual', 'india', 'active',
        '/stores/culture-circle.png', 3, 8,
        'Handling 1-3 days plus 2-5 days in transit, as stated on its product pages.',
        'https://www.culture-circle.com/products/all/yeezy-boost-350-v2-bone',
        'Free returns within 7 days, by mail (as stated on its product pages).',
        'ok',
        'Free shipping (rate of 0 rupees stated on its product pages)',
        'https://www.culture-circle.com/products/all/yeezy-boost-350-v2-bone', 10080)
ON CONFLICT (slug) DO UPDATE SET
  logo_url = EXCLUDED.logo_url, delivery_min_days = EXCLUDED.delivery_min_days, delivery_max_days = EXCLUDED.delivery_max_days,
  delivery_note = EXCLUDED.delivery_note, delivery_source_url = EXCLUDED.delivery_source_url,
  returns_note = EXCLUDED.returns_note, returns_tone = EXCLUDED.returns_tone, shipping_note = EXCLUDED.shipping_note,
  info_source_url = EXCLUDED.info_source_url, fetch_frequency_minutes = EXCLUDED.fetch_frequency_minutes, status = 'active';
