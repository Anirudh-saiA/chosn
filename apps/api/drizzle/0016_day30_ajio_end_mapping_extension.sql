-- Day 30 task 4: closes the Ajio / END. Clothing mapping gap Day 29's
-- staleness audit found — those two sources only ever covered the
-- original 5 launch models (0003_day7_sources.sql), never the 23 Day 28
-- additions. This is a coverage fix for the existing catalog, not a new
-- expansion — no new sneakers/variants, only retailer_product_mappings.
--
-- Run via `node dist/scripts/generate-day30-ajio-end-mappings.js` to
-- reproduce the exact report these mappings came from: 28 of 46
-- candidate (sneaker, retailer) pairs cleared the mapping-assist tool's
-- confidence floor (11 of 23 for Ajio, 17 of 23 for END.) — the other 18
-- were excluded (no_confident_match), not force-mapped. Same discipline
-- as Day 28: several of Ajio's terser "Brand Model Sneakers" titles and
-- END's dash-separated titles didn't carry enough of the colorway text
-- to clear MEDIUM for models with a distinctive nickname (Black Cat,
-- White Cement, Silver Bullet, Chicago) — a real signal that those
-- listings need a human to actually go find and confirm, not a
-- reason to force the mapping through.

INSERT INTO retailer_product_mappings (
  retailer_id, sneaker_id, retailer_raw_title, retailer_product_url,
  style_code, retailer_product_id, mapping_confidence, mapped_by, notes
)
SELECT r.id, s.id, m.raw_title, r.base_url || '/p/' || m.product_id, s.style_code, m.product_id, 'fuzzy', 'day-30-mapping-assist', m.note
FROM retailers r
JOIN (VALUES
  -- Ajio — 11 of 23 cleared the confidence floor
  ('ajio', 'CP9654',       'adidas Originals Yeezy Boost 350 V2 Zebra', 'AJIOFIXTURE008', 'score 0.59 (medium)'),
  ('ajio', 'M990GL5',      'New Balance 990v5 Grey Sneakers',           'AJIOFIXTURE009', 'score 0.58 (medium)'),
  ('ajio', '162050C',      'Converse Chuck Taylor 70 Hi Black Sneakers','AJIOFIXTURE010', 'score 0.69 (medium)'),
  ('ajio', 'BQ6806-100',   'Nike Blazer Mid 77 Vintage Sneakers',       'AJIOFIXTURE013', 'score 0.61 (medium)'),
  ('ajio', 'VN000D3HY28',  'Vans Old Skool Black White Sneakers',       'AJIOFIXTURE015', 'score 0.73 (medium)'),
  ('ajio', 'DD1391-103',   'Nike Dunk Low Grey Fog Sneakers',           'AJIOFIXTURE018', 'score 0.58 (medium)'),
  ('ajio', '1201A019-001', 'ASICS Gel Kayano 14 Black Sneakers',        'AJIOFIXTURE021', 'score 0.59 (medium)'),
  ('ajio', 'VN000D5IB8C',  'Vans Sk8-Hi Black White Sneakers',          'AJIOFIXTURE023', 'score 0.66 (medium)'),
  ('ajio', 'HQ6339',       'adidas Ultraboost Light Black Sneakers',    'AJIOFIXTURE025', 'score 0.55 (medium)'),
  ('ajio', 'BB550PB1',     'New Balance 550 White Grey Sneakers',       'AJIOFIXTURE026', 'score 0.73 (medium)'),
  ('ajio', '162053C',      'Converse Chuck 70 Hi Parchment Sneakers',   'AJIOFIXTURE027', 'score 0.65 (medium)'),
  -- END. Clothing — 17 of 23 cleared the confidence floor
  ('end-clothing', 'CP9654',       'adidas Yeezy Boost 350 V2 - Zebra',        'ENDFIXTURE008', 'score 0.64 (medium)'),
  ('end-clothing', 'M990GL5',      'New Balance 990v5 - Grey',                 'ENDFIXTURE009', 'score 0.67 (medium)'),
  ('end-clothing', '162050C',      'Converse Chuck 70 Hi - Black',             'ENDFIXTURE010', 'score 0.66 (medium)'),
  ('end-clothing', 'BB5476',       'adidas Gazelle - Core Black',              'ENDFIXTURE012', 'score 0.57 (medium)'),
  ('end-clothing', 'BQ6806-100',   'Nike Blazer Mid 77 Vintage - White/Black', 'ENDFIXTURE013', 'score 0.85 (high)'),
  ('end-clothing', 'VN000D3HY28',  'Vans Old Skool - Black/White',             'ENDFIXTURE015', 'score 0.85 (high)'),
  ('end-clothing', '352634-03',    'Puma Suede Classic - Black/White',         'ENDFIXTURE016', 'score 0.80 (medium)'),
  ('end-clothing', 'M2002RDA',     'New Balance 2002R - Rain Cloud',           'ENDFIXTURE017', 'score 0.61 (medium)'),
  ('end-clothing', 'DD1391-103',   'Nike Dunk Low - Grey Fog',                 'ENDFIXTURE018', 'score 0.67 (medium)'),
  ('end-clothing', '1201A019-001', 'ASICS Gel-Kayano 14 - Black',              'ENDFIXTURE021', 'score 0.67 (medium)'),
  ('end-clothing', 'DD1399-105',   'Nike Dunk High - Panda',                   'ENDFIXTURE022', 'score 0.59 (medium)'),
  ('end-clothing', 'VN000D5IB8C',  'Vans Sk8-Hi - Black/True White',           'ENDFIXTURE023', 'score 0.85 (high)'),
  ('end-clothing', 'B75807',       'adidas Samba OG - Core Black',             'ENDFIXTURE024', 'score 0.66 (medium)'),
  ('end-clothing', 'HQ6339',       'adidas Ultraboost Light - Core Black',     'ENDFIXTURE025', 'score 0.65 (medium)'),
  ('end-clothing', 'BB550PB1',     'New Balance 550 - White/Grey',             'ENDFIXTURE026', 'score 0.85 (high)'),
  ('end-clothing', '162053C',      'Converse Chuck 70 Hi - Parchment',         'ENDFIXTURE027', 'score 0.70 (medium)'),
  ('end-clothing', 'IV6028-100',   'Nike Air Force 1 07 LV8 - White/Black',    'ENDFIXTURE028', 'score 0.70 (medium)')
) AS m(slug, style_code, raw_title, product_id, note) ON m.slug = r.slug
JOIN sneakers s ON s.style_code = m.style_code
ON CONFLICT (retailer_id, sneaker_id) DO NOTHING;
