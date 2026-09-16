-- Day 32: root-causes and fixes the Superkicks/VegNonVeg 2-variant
-- failure Day 31 observed. Not a stale SKU/size mismatch and not a
-- fetcher bug — the diagnosis was already sitting in this repo's own
-- history: 0011_fix_manual_seed_listing_urls.sql (Day 20) verified
-- against both live sites on 2026-09-10 that Superkicks no longer
-- stocks adidas Samba OG "White" (B75806) and VegNonVeg no longer
-- stocks New Balance 550 "White/Green" (BB550WT1) — different
-- colorways are in stock, not these SKUs — and correctly deleted the
-- now-fictional manual_price_entries rows for both. What that migration
-- left behind was the retailer_product_mappings row itself, which still
-- tells ManualPriceAdapter "go price this listing" every single weekly
-- cycle. With no manual_price_entries row to read, the fetcher
-- permanently fails both variants (both sizes) every cycle, forever —
-- exactly the 2-failure count Day 31 observed on each retailer.
--
-- Confirmed locally before writing this: retailer_product_mappings
-- still carries the original Day 7 placeholder note
-- ("mapped_by": 'day-7-seed') for both rows, untouched since — this was
-- never re-verified or intentionally kept, just missed.
--
-- The fix per Day 32 task 5's own framing ("if the variant is genuinely
-- no longer available... mark it appropriately unavailable, not force a
-- match"): remove the mapping. Ajio/Flipkart/Myntra/END. still cover
-- B75806 (fixture-mode, per 0011's own note); BB550WT1 stays covered by
-- Flipkart. Neither sneaker loses all retailer coverage.

DELETE FROM retailer_product_mappings rpm
USING retailers r, sneakers s
WHERE rpm.retailer_id = r.id
  AND rpm.sneaker_id = s.id
  AND (
    (r.slug = 'superkicks' AND s.style_code = 'B75806') OR
    (r.slug = 'vegnonveg' AND s.style_code = 'BB550WT1')
  );
