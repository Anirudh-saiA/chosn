-- What shoppers say happened after they bought a shoe at a store they found through CHOSN. Anonymous: no name, e-mail or account. This is the
-- real evidence behind a store's "buyer outcomes" (arrived on time, as described, would buy again), which feeds its Trust score once a
-- store has enough answers (scripts/trust/compute_trust.py).
CREATE TABLE IF NOT EXISTS order_feedback (
  id                 bigserial PRIMARY KEY,
  created_at         timestamptz NOT NULL DEFAULT now(),
  style_code         text NOT NULL,
  size               numeric(4, 1),
  retailer_slug      text NOT NULL,
  bought             text NOT NULL CHECK (bought IN ('yes', 'no', 'later')),
  not_bought_reason  text,
  ordered_on         date,
  delivered_in_days  smallint,        -- NULL while it has not arrived
  promised_max_days  smallint,        -- the store's own stated maximum when the shopper clicked Buy
  arrived_on_time    boolean,         -- worked out from the two numbers above (one day of grace); NULL when it has not arrived yet
  as_described       text CHECK (as_described IN ('yes', 'no', 'unsure')),
  size_ok            text CHECK (size_ok IN ('yes', 'no', 'exchanged')),
  problems           text[] NOT NULL DEFAULT '{}',
  would_buy_again    boolean,
  comment            text,
  visitor_id         text
);
CREATE INDEX IF NOT EXISTS order_feedback_store_idx ON order_feedback (retailer_slug, created_at DESC) WHERE bought = 'yes';
CREATE INDEX IF NOT EXISTS order_feedback_shoe_idx ON order_feedback (style_code, retailer_slug);
