-- Reference data (the Retailer row) plus the small test set the Day 6
-- brief asks for: 5 sneakers x 2 sizes = 10 variants to fetch against.
--
-- Retailer rows are configuration, not fixtures — they belong in a
-- migration. The sneakers/variants here are genuinely a test set: real
-- style codes, so the mapping table exercises the real join key, but the
-- catalog proper gets seeded from the team's spreadsheet later (Day 1 §03
-- step 3 puts that loader in Phase 2, not here).

-- Flipkart: Day 1 §01 Tier 1, §04 "standard signup, standard terms,
-- lawyer review not needed" — the highest-confidence source to build
-- first. status stays pending_integration until real affiliate
-- credentials exist; the adapter reads that and runs in fixture mode.
INSERT INTO retailers (
  name, slug, base_url, integration_type, affiliate_link_template,
  region_focus, fetch_frequency_minutes, api_credentials_ref, status
)
VALUES (
  'Flipkart',
  'flipkart',
  'https://www.flipkart.com',
  'api',
  '{{productUrl}}?affid={{affiliateId}}',
  'india',
  720, -- 12h: Day 1 §01 puts Indian retail at 12–24h; feeds refresh daily anyway
  'FLIPKART_AFFILIATE_TOKEN',
  'pending_integration'
)
ON CONFLICT (slug) DO NOTHING;

-- Real style codes — the canonical join key from Day 1 §03.
INSERT INTO sneakers (brand, model, silhouette, colorway, style_code, gender, category, currency)
VALUES
  ('Nike',        'Dunk',      'Low Retro', 'White/Black (Panda)', 'DD1391-100', 'unisex', 'lifestyle', 'INR'),
  ('Nike',        'Air Force 1', '07',      'Triple White',        'CW2288-111', 'unisex', 'lifestyle', 'INR'),
  ('adidas',      'Samba',     'OG',        'Cloud White/Core Black', 'B75806',  'unisex', 'lifestyle', 'INR'),
  ('adidas',      'Campus',    '00s',       'Dark Green',          'HQ8708',    'unisex', 'lifestyle', 'INR'),
  ('New Balance', '550',       NULL,        'White/Green',         'BB550WT1',  'unisex', 'lifestyle', 'INR')
ON CONFLICT (style_code) DO NOTHING;

-- UK sizing, India region: Indian retailers list UK (Day 1 §03). The
-- source system is recorded rather than rewritten.
INSERT INTO sneaker_variants (sneaker_id, size, size_system, region)
SELECT s.id, v.size, 'uk', 'india'
FROM sneakers s
CROSS JOIN (VALUES (8.0), (9.0)) AS v(size)
WHERE s.style_code IN ('DD1391-100', 'CW2288-111', 'B75806', 'HQ8708', 'BB550WT1')
ON CONFLICT DO NOTHING;

-- One mapping per (retailer, sneaker) — what Flipkart calls each shoe.
-- mapping_confidence stays 'manual' until a human confirms the size run
-- matches too (Day 1 §03 step 4).
INSERT INTO retailer_product_mappings (
  retailer_id, sneaker_id, retailer_raw_title, retailer_product_url,
  style_code, retailer_product_id, mapping_confidence, mapped_by, notes
)
SELECT
  r.id,
  s.id,
  m.raw_title,
  'https://www.flipkart.com/p/' || m.product_id,
  s.style_code,
  m.product_id,
  'manual',
  'day-6-seed',
  'Placeholder mapping — product ids are fixtures until affiliate access is granted.'
FROM retailers r
JOIN (VALUES
  ('DD1391-100', 'Nike Dunk Low Retro White Black Panda', 'SHOFIXTURE001'),
  ('CW2288-111', 'Nike Air Force 1 07 Triple White',      'SHOFIXTURE002'),
  ('B75806',     'adidas Originals Samba OG White Black', 'SHOFIXTURE003'),
  ('HQ8708',     'adidas Campus 00s Dark Green',          'SHOFIXTURE004'),
  ('BB550WT1',   'New Balance 550 White Green',           'SHOFIXTURE005')
) AS m(style_code, raw_title, product_id) ON TRUE
JOIN sneakers s ON s.style_code = m.style_code
WHERE r.slug = 'flipkart'
ON CONFLICT (retailer_id, sneaker_id) DO NOTHING;
