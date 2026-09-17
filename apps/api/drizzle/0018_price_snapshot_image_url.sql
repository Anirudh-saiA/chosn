-- Product images, per retailer listing. The canonical, curated image
-- lives on sneakers.primary_image_url (Day 1's own canonical schema —
-- already exists, already flows through catalog/drops/search, already
-- has a placeholder consumer everywhere it's used). What's genuinely
-- missing is a per-retailer fallback: each retailer's own listing image,
-- captured at fetch time alongside price/stock, so a model with no
-- curated photo yet can still show *something* real rather than falling
-- straight to the placeholder.
--
-- Lives on price_snapshots, not a separate per-mapping table: an image
-- is exactly the kind of thing a retailer's own listing page reports
-- alongside price and stock, captured the same way, at the same time,
-- by the same adapter.normalize() step — a second side-channel table
-- updated on its own schedule would only ever drift from what the
-- fetch actually saw. ALTER TABLE on the partitioned parent propagates
-- to every existing and future monthly partition automatically
-- (standard Postgres declarative-partitioning behavior) — no per-
-- partition DDL needed.
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Same field, same reasoning, for the manual-boutique path — whoever
-- checks Superkicks/VegNonVeg by hand can now paste the listing's photo
-- URL alongside the price they already record. Optional: no existing
-- manual_price_entries row has ever had one, same as every retailer
-- fixture reports null today.
ALTER TABLE manual_price_entries ADD COLUMN IF NOT EXISTS image_url TEXT;
