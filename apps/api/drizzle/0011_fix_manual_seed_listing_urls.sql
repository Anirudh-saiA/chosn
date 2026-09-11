-- Day 20 fix: manual_price_entries for the two "live" manual boutique
-- sources (Superkicks, VegNonVeg) were seeded in 0003 with placeholder
-- `<base_url>/p/<SKU>` URLs. Verified live against both sites on
-- 2026-09-10: neither uses a `/p/` path at all (real pattern is
-- `/products/<slug>`), so all 8 seeded rows 404. This is the "broken
-- View Deal link" failure mode, and it hit the only two sources in the
-- catalog *not* running on fixtures — see OfferTable.tsx's disclosure
-- fix from the same pass for the fixture-mode side of this.
--
-- Verified against the live sites (2026-09-10):
--   - Nike Dunk Low Retro Panda (DD1391-100) is a real, SKU-matching
--     listing at both Superkicks and VegNonVeg, currently sold out at
--     both. Corrected to the real listing URL and real last-seen price,
--     with in_stock set to false rather than left true against a dead
--     link — a real "sold out" is honest; a live-looking button to a
--     404 is not.
--   - adidas Samba OG "White" (B75806) has no matching live listing on
--     Superkicks today — the site currently stocks other Samba OG
--     colorways (different SKUs), not this one. Rather than swap one
--     invented URL for another, this row is removed. Ajio/Flipkart/
--     Myntra/END. still show for this sneaker, now correctly labelled
--     fixture-mode.
--   - New Balance 550 "White/Green" (BB550WT1) has no matching live
--     listing on VegNonVeg for the same reason — row removed.
--
-- retailer_product_mappings.retailer_product_url for these two manual
-- rows has the same placeholder shape, but it isn't read at request time
-- (ManualPriceAdapter reads manual_price_entries directly) — left alone
-- here to keep this migration to the data that's actually user-facing.

WITH verified AS (
  SELECT
    mpe.id AS entry_id,
    m.price AS new_price,
    m.listing_url AS new_listing_url
  FROM manual_price_entries mpe
  JOIN retailers r ON r.id = mpe.retailer_id
  JOIN sneaker_variants v ON v.id = mpe.sneaker_variant_id
  JOIN sneakers s ON s.id = v.sneaker_id
  JOIN (VALUES
    ('superkicks', 'DD1391-100', 6636::numeric, 'https://www.superkicks.in/products/dunk-low-black'),
    ('vegnonveg',  'DD1391-100', 8295::numeric, 'https://www.vegnonveg.com/products/nike-dunk-low-retro-whiteblack-white')
  ) AS m(slug, style_code, price, listing_url)
    ON m.slug = r.slug AND m.style_code = s.style_code
)
UPDATE manual_price_entries mpe
SET
  price = verified.new_price,
  listing_url = verified.new_listing_url,
  in_stock = false,
  recorded_at = now(),
  notes = 'Corrected 2026-09-10 (Day 20): prior row pointed at a placeholder /p/ URL that 404s. Verified the real listing exists but is currently sold out.'
FROM verified
WHERE mpe.id = verified.entry_id;

DELETE FROM manual_price_entries mpe
USING retailers r, sneaker_variants v, sneakers s
WHERE mpe.retailer_id = r.id
  AND mpe.sneaker_variant_id = v.id
  AND v.sneaker_id = s.id
  AND (
    (r.slug = 'superkicks' AND s.style_code = 'B75806') OR
    (r.slug = 'vegnonveg' AND s.style_code = 'BB550WT1')
  );
