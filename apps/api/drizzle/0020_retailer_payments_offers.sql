-- What a shopper needs to know before clicking through to a store: how they can pay, shipping charges, the
-- returns rule and any live offers. Only facts the store itself publishes are stored, each with the page it
-- came from. Nothing is filled in for a store that does not say it (no guessed wallets / bank offers).
--   payment_methods  text[]  e.g. {UPI,"Credit & debit cards","Cash on delivery"}
--   shipping_note    text    e.g. 'Free shipping on orders above ₹9,999'
--   returns_note     text    the store's return / exchange rule in one line
--   returns_tone     text    'ok' | 'limited' | 'none'  (how friendly the rule is, for the colour on the card)
--   info_source_url  text    the page the above was read from
--   offers           jsonb   live offers [{ "text": "...", "url": "..." }], refreshed by the daily update
--   offers_updated_at timestamptz

ALTER TABLE retailers ADD COLUMN IF NOT EXISTS payment_methods   text[];
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS shipping_note     text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS returns_note      text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS returns_tone      text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS info_source_url   text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS offers            jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS offers_updated_at timestamptz;

-- Superkicks — https://www.superkicks.in/pages/faq (Payment, Returns) and /policies/shipping-policy
UPDATE retailers SET
  payment_methods = ARRAY['UPI', 'Net banking', 'Credit & debit cards', 'EMI', 'Pay later', 'Cash on delivery'],
  shipping_note   = 'Free shipping on orders above ₹9,999',
  returns_note    = '7-day returns/exchanges in eligible cases (size exchange, or credit note if your size is out of stock)',
  returns_tone    = 'limited',
  info_source_url = 'https://www.superkicks.in/pages/faq'
WHERE slug = 'superkicks';

-- VegNonVeg — https://www.vegnonveg.com/faq and /shipping-information, /return-and-exchange
UPDATE retailers SET
  payment_methods = ARRAY['UPI', 'Credit & debit cards', 'Net banking', 'Cardless EMI'],
  shipping_note   = 'Free shipping on orders above ₹2,000 (₹150 below that)',
  returns_note    = 'All sales are final, but a genuine size exchange is possible within 7 days if unworn',
  returns_tone    = 'limited',
  info_source_url = 'https://www.vegnonveg.com/faq'
WHERE slug = 'vegnonveg';

-- Crepdog Crew — https://crepdogcrew.com/policies/refund-policy ("we don't accept any returns or offer refunds")
-- and the site banner "Pay In Easy Installments". The banner says cash on delivery is for apparel, so it is not
-- listed for sneakers.
UPDATE retailers SET
  payment_methods = ARRAY['Pay in installments'],
  shipping_note   = 'Standard delivery 8–10 business days; Instant Shipping on select products',
  returns_note    = 'No returns or refunds at the moment',
  returns_tone    = 'none',
  info_source_url = 'https://crepdogcrew.com/policies/refund-policy'
WHERE slug = 'crepdog-crew';
