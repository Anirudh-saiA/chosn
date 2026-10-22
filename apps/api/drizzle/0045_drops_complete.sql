-- Drops, completed: admin editing, reminders, follows, India status, and the homegrown-brand scanner.

-- A drop can be hidden (not approved) without deleting it, can carry a story, and says whether it is coming to India.
ALTER TABLE drop_events ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE drop_events ADD COLUMN IF NOT EXISTS story text;
ALTER TABLE drop_events ADD COLUMN IF NOT EXISTS india_status text NOT NULL DEFAULT 'unknown';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drop_events_india_status_chk') THEN
    ALTER TABLE drop_events ADD CONSTRAINT drop_events_india_status_chk CHECK (india_status IN ('unknown', 'confirmed_india', 'global_only'));
  END IF;
END $$;

-- "Notify me": one row per drop, shopper (anonymous watch id) and lead time. The shopper's size is kept for the size-landed alert.
CREATE TABLE IF NOT EXISTS drop_reminders (
  id bigserial PRIMARY KEY,
  watch_id uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  drop_id uuid NOT NULL REFERENCES drop_events(id) ON DELETE CASCADE,
  minutes_before integer NOT NULL CHECK (minutes_before IN (15, 60, 1440)),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (watch_id, drop_id, minutes_before)
);
CREATE INDEX IF NOT EXISTS drop_reminders_due_idx ON drop_reminders (drop_id) WHERE sent_at IS NULL;

-- Follows: a single drop, a brand, or a collab. size is used for the "your size just landed" alert.
CREATE TABLE IF NOT EXISTS drop_follows (
  watch_id uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('drop', 'brand', 'collab')),
  ref text NOT NULL,                 -- drop id, brand name, or collab name
  size numeric(4, 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  landed_alert_at timestamptz,
  PRIMARY KEY (watch_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS drop_follows_ref_idx ON drop_follows (kind, ref);

-- More kinds of bell alert.
ALTER TABLE watch_alerts DROP CONSTRAINT IF EXISTS watch_alerts_kind_check;
ALTER TABLE watch_alerts DROP CONSTRAINT IF EXISTS watch_alerts_kind_chk;
ALTER TABLE watch_alerts ADD CONSTRAINT watch_alerts_kind_chk CHECK (kind IN
  ('back_in_stock', 'price_drop', 'target_reached', 'sold_out', 'drop_reminder', 'new_drop', 'size_landed'));

-- Public product data of Indian homegrown brands (scripts/scan_brand_sites.py): newest products, pre-orders and coming-soon items.
CREATE TABLE IF NOT EXISTS brand_watch_products (
  brand text NOT NULL,
  product_id text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  price_inr integer,
  image_url text,
  published_at timestamptz,
  available boolean NOT NULL DEFAULT true,
  tags text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL DEFAULT 'product' CHECK (kind IN ('product', 'preorder', 'coming_soon')),
  first_seen date NOT NULL DEFAULT current_date,
  last_seen date NOT NULL DEFAULT current_date,
  PRIMARY KEY (brand, product_id)
);
CREATE INDEX IF NOT EXISTS brand_watch_recent_idx ON brand_watch_products (brand, published_at DESC);
