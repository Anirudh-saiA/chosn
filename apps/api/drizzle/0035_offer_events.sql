-- First-party, anonymous shopper signals, per shoe: a "view" when someone opens a shoe's comparison page and a "click" when they press
-- Buy at a store (with where that store sat in the list and how the list was sorted, so list position can be corrected for later).
-- No name, e-mail or account is stored. visitor_id is a random token kept only when the visitor has agreed to analytics; it lets us count
-- repeat visitors and nothing else. These counts become "chosen by N shoppers for this shoe" and, with enough data, a position-adjusted
-- store preference.
CREATE TABLE IF NOT EXISTS offer_events (
  id            bigserial PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  event         text NOT NULL CHECK (event IN ('view', 'click')),
  style_code    text NOT NULL,
  size          numeric(4, 1),
  retailer_slug text,
  price         integer,
  position      smallint,
  sort_mode     text,
  visitor_id    text
);
CREATE INDEX IF NOT EXISTS offer_events_shoe_idx ON offer_events (style_code, created_at DESC);
CREATE INDEX IF NOT EXISTS offer_events_store_idx ON offer_events (retailer_slug, created_at DESC) WHERE event = 'click';
