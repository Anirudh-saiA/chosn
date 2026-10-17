-- Mainstreet Marketplace (https://marketplace.mainstreet.co.in): an Indian resale marketplace that imports sneakers to
-- order and prices them in rupees. Facts below come from its own policy pages (read 17 Oct 2026):
--   /policies/refund-policy    no returns for change of mind; damaged or wrong item: store credit or full refund
--   /policies/shipping-policy  shipping cost set at checkout (Standard or Express), Blue Dart / DHL, 2-7 days in transit
--   product listings           "Ships In 28 Days" (imported to order)
-- Myntra was left at status pending_integration; it is a live scraped store now, so both are marked active.

INSERT INTO retailers (name, slug, base_url, integration_type, region_focus, status, logo_url,
                       delivery_min_days, delivery_max_days, delivery_note, delivery_source_url,
                       returns_note, returns_tone, shipping_note, info_source_url)
VALUES ('Mainstreet Marketplace', 'mainstreet-marketplace', 'https://marketplace.mainstreet.co.in', 'manual', 'india', 'active',
        '/stores/mainstreet-marketplace.png', 28, 28,
        'Imported to order: listings say "Ships in 28 days". Once dispatched, 2–7 days in transit within India.',
        'https://marketplace.mainstreet.co.in/policies/shipping-policy',
        'No returns for change of mind. Damaged or wrong item: store credit or full refund after verification.',
        'none',
        'Shipping cost is worked out at checkout (Standard or Express, via Blue Dart or DHL)',
        'https://marketplace.mainstreet.co.in/policies/refund-policy')
ON CONFLICT (slug) DO UPDATE SET
  logo_url = EXCLUDED.logo_url, delivery_min_days = EXCLUDED.delivery_min_days, delivery_max_days = EXCLUDED.delivery_max_days,
  delivery_note = EXCLUDED.delivery_note, delivery_source_url = EXCLUDED.delivery_source_url,
  returns_note = EXCLUDED.returns_note, returns_tone = EXCLUDED.returns_tone, shipping_note = EXCLUDED.shipping_note,
  info_source_url = EXCLUDED.info_source_url, status = 'active';

UPDATE retailers SET status = 'active' WHERE slug = 'myntra';
