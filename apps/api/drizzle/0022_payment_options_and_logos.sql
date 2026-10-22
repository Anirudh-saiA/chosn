-- Everything a shopper can pay with at each store, grouped (UPI, cards, wallets, EMI ...), plus the store's logo.
-- Only what a store itself shows is stored; each group says where it was seen. Nothing is guessed: a method the
-- store does not mention is simply absent, and "Cash on delivery: no" is stored only when the store says so.
--   payment_options  jsonb  [{ "kind": "wallet", "label": "Wallets", "items": ["PhonePe", ...], "note": "...", "source": "...", "seenAt": "2026-10-17" }]
--   logo_url         text   already exists; now filled from /stores/*.png (cropped from each store's own site header)

ALTER TABLE retailers ADD COLUMN IF NOT EXISTS payment_options jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE retailers SET logo_url = '/stores/superkicks.png'   WHERE slug = 'superkicks';
UPDATE retailers SET logo_url = '/stores/crepdog-crew.png' WHERE slug = 'crepdog-crew';
UPDATE retailers SET logo_url = '/stores/vegnonveg.png'    WHERE slug = 'vegnonveg';

-- Superkicks: https://www.superkicks.in/pages/faq ("UPI, Net Banking, Credit & Debit cards, EMI options as well as
-- Cash on Delivery"; "buy now pay-later options as well as EMI plans visible on product display pages").
UPDATE retailers SET payment_options = '[
  {"kind":"upi","label":"UPI","items":["UPI"]},
  {"kind":"netbanking","label":"Net banking","items":["Net banking"]},
  {"kind":"card","label":"Cards","items":["Credit cards","Debit cards"]},
  {"kind":"emi","label":"EMI & pay later","items":["EMI instalments","Pay later"],"note":"The monthly amount is shown on each product page."},
  {"kind":"cod","label":"Cash on delivery","items":["Cash on delivery"]}
]'::jsonb WHERE slug = 'superkicks';

-- VegNonVeg: https://www.vegnonveg.com/faq ("UPI, credit/debit cards, net banking, and cardless EMI options available
-- at checkout"; "Sorry! We don't have Cash on delivery available"; store credit can be applied at checkout).
UPDATE retailers SET payment_options = '[
  {"kind":"upi","label":"UPI","items":["UPI"]},
  {"kind":"netbanking","label":"Net banking","items":["Net banking"]},
  {"kind":"card","label":"Cards","items":["Credit cards","Debit cards"]},
  {"kind":"emi","label":"EMI","items":["Cardless EMI"]},
  {"kind":"credit","label":"Store credit","items":["VNV store credit"],"note":"Apply it on the payment page at checkout."},
  {"kind":"cod","label":"Cash on delivery","items":[],"unavailable":true,"note":"Not available"}
]'::jsonb WHERE slug = 'vegnonveg';

-- Crepdog Crew: wallets as listed on its payment page (PayU), seen 17 Oct 2026; EMI and "Partial COD" as labelled on
-- its product pages. UPI / card / net banking are not listed because that page did not show them to us.
UPDATE retailers SET payment_options = '[
  {"kind":"wallet","label":"Wallets","items":["Airtel Payments Bank","Amazon Pay","OlaMoney (Postpaid + Wallet)","Mobikwik wallet","PhonePe"],"source":"Crepdog Crew payment page (PayU)","seenAt":"2026-10-17"},
  {"kind":"emi","label":"EMI","items":["3 or 6 month EMI"],"note":"Instalments via Snapmint; the monthly amount is on each product page.","source":"Crepdog Crew product page","seenAt":"2026-10-17"},
  {"kind":"cod","label":"Partial COD","items":["Partial cash on delivery"],"note":"Labelled on the product page; terms are on the store.","source":"Crepdog Crew product page","seenAt":"2026-10-17"}
]'::jsonb WHERE slug = 'crepdog-crew';
