-- Wishlist alerts. A "watch" is one anonymous device (random id kept in the browser) plus an optional e-mail the shopper confirmed.
-- Items are the shoes + sizes they hearted; alerts are what the nightly job found (back in stock, price drop, target reached, sold out).
CREATE TABLE IF NOT EXISTS watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text,
  email_confirmed boolean NOT NULL DEFAULT false,
  confirm_token text,
  unsubscribe_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  email_instant boolean NOT NULL DEFAULT true,
  email_weekly boolean NOT NULL DEFAULT true,
  last_digest_at timestamptz
);
CREATE TABLE IF NOT EXISTS watch_items (
  watch_id uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  style_code text NOT NULL,
  size numeric(4, 1),
  target_price integer,
  last_in_stock boolean,
  last_price integer,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (watch_id, style_code)
);
CREATE TABLE IF NOT EXISTS watch_alerts (
  id bigserial PRIMARY KEY,
  watch_id uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  style_code text NOT NULL,
  size numeric(4, 1),
  kind text NOT NULL CHECK (kind IN ('back_in_stock', 'price_drop', 'target_reached', 'sold_out')),
  message text NOT NULL,
  price integer,
  store text,
  read_at timestamptz,
  emailed_at timestamptz
);
CREATE INDEX IF NOT EXISTS watch_alerts_watch_idx ON watch_alerts (watch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS watch_alerts_unsent_idx ON watch_alerts (watch_id) WHERE emailed_at IS NULL;
