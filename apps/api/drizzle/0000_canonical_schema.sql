-- Canonical schema from the Day 1 foundation spec.
--
-- Hand-authored rather than drizzle-kit generated: price_snapshots is a
-- partitioned table (0001), and generators can't express PARTITION BY.
-- Keeping all DDL hand-written keeps one source of truth instead of a
-- generated file plus a pile of hand-edits on top of it.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE gender AS ENUM ('men', 'women', 'unisex', 'gs', 'td');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE category AS ENUM ('basketball', 'lifestyle', 'running', 'skate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE size_system AS ENUM ('us', 'uk', 'eu', 'cm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE region AS ENUM ('india', 'us', 'global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No 'scrape' value: Day 1 §01 dropped it deliberately, pricing Tier 2
-- sources manually instead. No enum value because no code path.
DO $$ BEGIN
  CREATE TYPE integration_type AS ENUM ('api', 'affiliate_feed', 'partner', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE retailer_status AS ENUM ('active', 'pending_integration', 'legal_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE condition AS ENUM ('new', 'used');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE price_type AS ENUM ('retail', 'resale', 'auction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mapping_confidence AS ENUM ('manual', 'verified', 'fuzzy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sneakers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand               TEXT NOT NULL,
  model               TEXT NOT NULL,
  silhouette          TEXT,
  colorway            TEXT NOT NULL,
  style_code          TEXT NOT NULL,
  gender              gender NOT NULL DEFAULT 'unisex',
  category            category,
  release_date        DATE,
  retail_price        NUMERIC(12, 2),
  currency            TEXT NOT NULL DEFAULT 'INR',
  primary_image_url   TEXT,
  gallery_image_refs  TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sneakers_style_code_key ON sneakers (style_code);

CREATE TABLE IF NOT EXISTS sneaker_variants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sneaker_id   UUID NOT NULL REFERENCES sneakers (id) ON DELETE CASCADE,
  size         NUMERIC(4, 1) NOT NULL,
  size_system  size_system NOT NULL,
  region       region NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Re-fetching must not create duplicate variants for the same listing.
CREATE UNIQUE INDEX IF NOT EXISTS sneaker_variants_unique
  ON sneaker_variants (sneaker_id, size, size_system, region);
CREATE INDEX IF NOT EXISTS sneaker_variants_sneaker_idx
  ON sneaker_variants (sneaker_id);

CREATE TABLE IF NOT EXISTS retailers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  slug                     TEXT NOT NULL,
  logo_url                 TEXT,
  base_url                 TEXT NOT NULL,
  integration_type         integration_type NOT NULL,
  affiliate_link_template  TEXT,
  region_focus             region NOT NULL,
  fetch_frequency_minutes  INTEGER NOT NULL DEFAULT 720,
  -- A pointer into the secrets store, never the credential itself.
  api_credentials_ref      TEXT,
  status                   retailer_status NOT NULL DEFAULT 'pending_integration',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS retailers_slug_key ON retailers (slug);

CREATE TABLE IF NOT EXISTS retailer_product_mappings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id           UUID NOT NULL REFERENCES retailers (id) ON DELETE CASCADE,
  sneaker_id            UUID NOT NULL REFERENCES sneakers (id) ON DELETE CASCADE,
  sneaker_variant_id    UUID REFERENCES sneaker_variants (id) ON DELETE SET NULL,
  retailer_raw_title    TEXT NOT NULL,
  retailer_product_url  TEXT NOT NULL,
  style_code            TEXT NOT NULL,
  retailer_product_id   TEXT,
  mapping_confidence    mapping_confidence NOT NULL DEFAULT 'manual',
  mapped_by             TEXT,
  mapped_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                 TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS retailer_product_mappings_unique
  ON retailer_product_mappings (retailer_id, sneaker_id);
CREATE INDEX IF NOT EXISTS retailer_product_mappings_lookup_idx
  ON retailer_product_mappings (retailer_id, style_code);

CREATE TABLE IF NOT EXISTS market_summaries (
  sneaker_variant_id  UUID PRIMARY KEY REFERENCES sneaker_variants (id) ON DELETE CASCADE,
  current_price       NUMERIC(12, 2),
  best_price          NUMERIC(12, 2),
  best_retailer_id    UUID REFERENCES retailers (id) ON DELETE SET NULL,
  avg_30d             NUMERIC(12, 2),
  avg_90d             NUMERIC(12, 2),
  trend_pct           NUMERIC(6, 2),
  signal              TEXT,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Created by hand in Day 5 (apps/api/src/db/migrate.ts) before a migration
-- tool existed. Declared here so a fresh database matches a migrated one;
-- IF NOT EXISTS makes it a no-op on the already-deployed database.
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  interests  TEXT[] NOT NULL DEFAULT '{}',
  source     TEXT NOT NULL DEFAULT 'landing_page',
  confirmed  BOOLEAN NOT NULL DEFAULT true,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
