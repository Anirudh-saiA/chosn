-- Day 7: the rest of the Day 1 v1 retailer list, plus the tables that
-- manual sourcing and fetch monitoring need.
--
-- FETCH CADENCE (Day 7 task 4, per-source tuning). Day 7 suggests 15 min
-- for API sources, but Day 1 §01's cadence table puts Indian retail at
-- 12–24h and resale at 1–4h, with the reasoning that affiliate networks
-- refresh their own feeds about once a day regardless. Polling a
-- daily-refreshing feed every 15 minutes is ~96x the requests for
-- identical data, and the fastest way to get rate-limited off a source we
-- depend on. Day 1's cadences are used; the column is per-retailer, so a
-- resale source added later gets 1–4h without a code change.

CREATE TABLE IF NOT EXISTS manual_price_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id         UUID NOT NULL REFERENCES retailers (id) ON DELETE CASCADE,
  sneaker_variant_id  UUID NOT NULL REFERENCES sneaker_variants (id) ON DELETE CASCADE,
  price               NUMERIC(12, 2),
  shipping_cost       NUMERIC(12, 2),
  currency            TEXT NOT NULL DEFAULT 'INR',
  condition           condition NOT NULL DEFAULT 'new',
  in_stock            BOOLEAN NOT NULL DEFAULT true,
  listing_url         TEXT NOT NULL,
  recorded_by         TEXT NOT NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS manual_price_entries_lookup_idx
  ON manual_price_entries (retailer_id, sneaker_variant_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS fetch_failures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_slug  TEXT NOT NULL,
  style_code     TEXT,
  size           NUMERIC(4, 1),
  reason         TEXT NOT NULL,
  attempts       INTEGER NOT NULL DEFAULT 1,
  failed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fetch_failures_recent_idx
  ON fetch_failures (retailer_slug, failed_at DESC);

-- ------------------------------------------------------------ retailers

INSERT INTO retailers (
  name, slug, base_url, integration_type, affiliate_link_template,
  region_focus, fetch_frequency_minutes, api_credentials_ref, status
)
VALUES
  -- Tier 1 affiliate feeds. 720 min = 12h, matching Day 1 §01 retail.
  ('Myntra', 'myntra', 'https://www.myntra.com', 'affiliate_feed',
   '{{productUrl}}?utm_source=admitad&subid={{subId}}', 'india', 720,
   'ADMITAD_ACCESS_TOKEN', 'pending_integration'),

  ('Ajio', 'ajio', 'https://www.ajio.com', 'affiliate_feed',
   '{{productUrl}}?ref=inrdeals&pub={{publisherId}}', 'india', 720,
   'INRDEALS_API_TOKEN', 'pending_integration'),

  -- END. is UK-based and ships to India; 24h because a global retailer's
  -- INR-relevant pricing moves with FX and sale events, not intraday.
  ('END. Clothing', 'end-clothing', 'https://www.endclothing.com', 'affiliate_feed',
   '{{productUrl}}?awc={{awinClickRef}}', 'global', 1440,
   'AWIN_API_TOKEN', 'pending_integration'),

  -- Tier 2, hand-priced. Day 1 §01: "Weekly / event-triggered".
  -- 10080 min = 7 days. The job still runs weekly; what it does is read
  -- the manual table and fail loudly if the entry has gone stale.
  ('Superkicks', 'superkicks', 'https://www.superkicks.in', 'manual',
   '{{productUrl}}', 'india', 10080, NULL, 'active'),

  ('VegNonVeg', 'vegnonveg', 'https://www.vegnonveg.com', 'manual',
   '{{productUrl}}', 'india', 10080, NULL, 'active')
ON CONFLICT (slug) DO NOTHING;

-- Adidas India, StockX, GOAT and Culture Circle are deliberately NOT
-- added with adapters today:
--   * Adidas India — Day 1 §01 flags it "sneaker inclusion unverified"
--     and §04 requires light legal review to confirm the category sits
--     inside the commission structure. That's a business question, not a
--     code one, and building against it first would be guesswork.
--   * StockX / GOAT — Day 1 §04 marks lawyer review REQUIRED and Day 1
--     Assumption 05 rules out any automated access without a signed
--     agreement. No adapter exists because no lawful fetch path does.
--   * Culture Circle — partnership agreed "in writing before any
--     automated fetch" (§04).
-- They stay off the list rather than sitting as pending rows that look
-- like something is coming.

-- ------------------------------------------------------- product mappings

-- One mapping per (retailer, sneaker), against the same five test
-- sneakers Day 6 seeded, so every source is fetched for the same catalog
-- and the cross-retailer comparison in task 5 is apples-to-apples.
INSERT INTO retailer_product_mappings (
  retailer_id, sneaker_id, retailer_raw_title, retailer_product_url,
  style_code, retailer_product_id, mapping_confidence, mapped_by, notes
)
SELECT
  r.id,
  s.id,
  m.raw_title,
  r.base_url || '/p/' || m.product_id,
  s.style_code,
  m.product_id,
  'manual',
  'day-7-seed',
  'Placeholder mapping — product ids are fixtures until affiliate access is granted.'
FROM retailers r
JOIN (VALUES
  -- Myntra (Admitad)
  ('myntra',       'DD1391-100', 'Nike Dunk Low Retro White Black',        'MYNFIXTURE001'),
  ('myntra',       'CW2288-111', 'Nike Air Force 1 07 White',              'MYNFIXTURE002'),
  ('myntra',       'B75806',     'adidas Samba OG Cloud White',            'MYNFIXTURE003'),
  ('myntra',       'HQ8708',     'adidas Campus 00s Dark Green',           'MYNFIXTURE004'),
  ('myntra',       'BB550WT1',   'New Balance 550 White Green',            'MYNFIXTURE005'),
  -- Ajio (INRDeals)
  ('ajio',         'DD1391-100', 'Nike Dunk Low Panda Sneakers',           'AJIOFIXTURE001'),
  ('ajio',         'CW2288-111', 'Nike Air Force 1 07 Triple White',       'AJIOFIXTURE002'),
  ('ajio',         'B75806',     'adidas Originals Samba OG',              'AJIOFIXTURE003'),
  ('ajio',         'HQ8708',     'adidas Originals Campus 00s',            'AJIOFIXTURE004'),
  ('ajio',         'BB550WT1',   'New Balance 550 Court Sneakers',         'AJIOFIXTURE005'),
  -- END. Clothing (Awin)
  ('end-clothing', 'DD1391-100', 'Nike Dunk Low Retro - White/Black',      'ENDFIXTURE001'),
  ('end-clothing', 'CW2288-111', 'Nike Air Force 1 07 - White',            'ENDFIXTURE002'),
  ('end-clothing', 'B75806',     'adidas Samba OG - Cloud White',          'ENDFIXTURE003'),
  ('end-clothing', 'HQ8708',     'adidas Campus 00s - Dark Green',         'ENDFIXTURE004'),
  ('end-clothing', 'BB550WT1',   'New Balance 550 - White/Green',          'ENDFIXTURE005'),
  -- Manual boutiques: product id is the shop's own SKU reference.
  ('superkicks',   'DD1391-100', 'Nike Dunk Low Retro Panda',              'SK-DUNK-PANDA'),
  ('superkicks',   'B75806',     'adidas Samba OG White',                  'SK-SAMBA-OG'),
  ('vegnonveg',    'DD1391-100', 'Nike Dunk Low Panda',                    'VNV-DUNK-PANDA'),
  ('vegnonveg',    'BB550WT1',   'New Balance 550 White Green',            'VNV-NB550')
) AS m(slug, style_code, raw_title, product_id) ON m.slug = r.slug
JOIN sneakers s ON s.style_code = m.style_code
ON CONFLICT (retailer_id, sneaker_id) DO NOTHING;

-- --------------------------------------------------- seed manual prices

-- Two boutiques x their mapped models x both sizes, recorded "today" so
-- they're inside the freshness window. In production these rows come from
-- the team checking the shop; here they prove the manual path end to end.
INSERT INTO manual_price_entries (
  retailer_id, sneaker_variant_id, price, shipping_cost, currency,
  condition, in_stock, listing_url, recorded_by, notes
)
SELECT
  r.id,
  v.id,
  m.base_price + ((v.size - 8) * 150),
  0,
  'INR',
  'new',
  true,
  r.base_url || '/p/' || rpm.retailer_product_id,
  'day-7-seed',
  'Seed entry demonstrating the manual pricing path.'
FROM retailers r
JOIN retailer_product_mappings rpm ON rpm.retailer_id = r.id
JOIN sneakers s ON s.id = rpm.sneaker_id
JOIN sneaker_variants v ON v.sneaker_id = s.id
JOIN (VALUES
  ('superkicks', 'DD1391-100', 9750::numeric),
  ('superkicks', 'B75806',     10450::numeric),
  ('vegnonveg',  'DD1391-100', 9899::numeric),
  ('vegnonveg',  'BB550WT1',   13250::numeric)
) AS m(slug, style_code, base_price)
  ON m.slug = r.slug AND m.style_code = s.style_code
WHERE r.integration_type = 'manual';
