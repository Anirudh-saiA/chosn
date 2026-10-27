# Data: offer-text characters and rows under Rs 1,500 (card data-offer-text-lowprice), 2026-10-27

## 1. Rupee sign in offer text: already correct everywhere I can read it (Confirmed 2026-10-27)
Checked, byte level, every step from the scraper to the API:
- `scripts/offers/curated_offers.json`: the rupee sign is stored as the proper UTF-8 bytes (E2 82 B9); no broken sequence.
- `data/daily/2026-10-24`, `-26`, `-27/store_offers.json` (scraper output): no broken sequence (the 27 Oct file holds no rupee text at all).
- Code: `scripts/scrape_store_offers.py` decodes pages as UTF-8 and writes UTF-8; `apps/api/src/scripts/import-store-offers.ts` reads the files as UTF-8 (`readFileSync(file, 'utf8')`). No Latin-1 step.
- Database: `retailers.offers` for 5 stores (crepdog-crew, mainstreet-marketplace, myntra, superkicks, vegnonveg), updated 2026-10-27: 0 broken strings (searched for the letter a-circumflex). The Crepdog Mobikwik text reads "scratch card for ₹1 – ₹75 cashback".
- API: `GET /catalog/HF5441-100/8` returns `Content-Type: application/json; charset=utf-8` and the offers text with the correct bytes (8 rupee signs, 0 broken).
So there is nothing to fix in the scraper or the import. The broken characters were most likely produced by whatever read the response (a terminal or script that decoded UTF-8 as Windows-1252; the rupee sign E2 82 B9 shows as three Latin characters that way) or by an earlier copy of the data that has since been replaced. If Frontend still sees them in the browser, the page needs a charset check (the response headers are right), and I need the exact URL.

## 2. Rows under Rs 1,500 (current rows, test rows excluded): 1,128 size rows, 213 shoes, lowest Rs 475
List: `data/proposals/rows-under-1500-2026-10-27.csv` (store, style code, brand, model, lowest price, rows, rows in stock, class, link).
| Store | Shoes | What they are |
|---|---|---|
| Myntra | 132 | **Real**: budget brands (Roadster, Layasa, JQR, yoho and similar), prices Rs 475 to 1,499. Real listings, but not sneaker-brand pairs; whether the budget shelf should show them is a product decision. Myntra has no manufacturer style code, so these rows carry our own N- codes |
| Superkicks | 45 | 31 slides / flip-flops (Jordan Break Slide, Victori One Slide, Bella Kai...), 4 likely slides by name, 6 real low-price pairs (Vans Authentic and Classic Slip-On, Nike Revolution 8, Reebok kids Club C), 4 to check by hand (Vila Drifter and similar). **All of them are out of stock**, so their price is the last price seen |
| Puma India | 25 | All slides, flip-flops or sandals (Flame Women's Flip-Flops, Stellar V6 Slides, Wave Sandals...) |
| Mainstreet Marketplace | 11 | All flip-flops and slides (adidas Hurtle, Mistico, Stabile, Aquo) |
**The trainer at Rs 569 with 1 store** is Puma "Flame Women's Flip-Flops" (style 39715401, Puma India, in stock, https://in.puma.com/in/en/pd/flame-womens-flip-flops/397154): a real price for a real product, but it is a flip-flop, not a sneaker. It is a scraper-scope mistake, not a price error.
Real or mistake: no row is a wrong price (no zero, blank or decimal-slip prices; the lowest is Rs 475). 67 of the 213 shoes are not sneakers (slides, flip-flops, sandals) from Puma, Superkicks and Mainstreet; Myntra's 132 are real but out of our brand scope.

## Proposed fix (not applied; no database change)
1. Scope filter in the scrapers: skip slides, flip-flops, sandals, slippers and clogs. Puma: add `slides?|flip-flops?|sandals?|slippers?` to `NOT_SHOES` in `scripts/scrape_puma_prices.py` (it filters by page slug today). Superkicks, Crepdog, Mainstreet (Shopify): skip by `product_type` / tags / title in `scripts/scrape_shopify_prices.py` and `scripts/scrape_mainstreet_prices.py`. Data can do this on team/data once the founder agrees that slides are out of scope (CHOSN is a sneaker site; Jordan and adidas slides are sneaker-brand products, so this is a product decision).
2. Existing slide rows stay in the history (append-only). The shelf can exclude them by a category field; the cleanest filter is a `category` on `sneakers` filled from the scrape (Back end).
3. Budget shelf: show a price floor only with a brand or category rule, not a bare price cut.
