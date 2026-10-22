---
name: crawlee-scraping
description: Scrape sneaker listings from retailer sites into the CHOSN price-import CSV using Crawlee (scripts/crawl). Use when adding a new store scraper, re-running VegNonVeg/Superkicks/Crepdog scrapes, or debugging blocked/empty scrapes.
---

# Scraping with Crawlee (scripts/crawl)

Output must match the price-import CSV: `brand,model,colorway,style_code,size,retailer,price,shipping,url,in_stock,image_url,size_system,condition` (see `scripts/crawl/csv.mjs`). One row per size. Rows with no style code go to a sibling `*-missing-style-code.csv`.

## Pick the cheapest approach that works
1. **Shopify store?** Try `<base>/products.json?limit=250&page=N`. If it returns JSON, use plain HTTP (`scripts/scrape_shopify_prices.py`, `scripts/top_shopify_prices.py`). No browser needed. `sort_by` is ignored by products.json; read best-selling order from the collection HTML page instead.
2. **Server-rendered custom site** (e.g. VegNonVeg): `CheerioCrawler` (see `scripts/crawl/vegnonveg.mjs`).
3. **JS-rendered / bot-protected site**: `PlaywrightCrawler` (Chromium already installed via `npx playwright install chromium`). Prefer capturing the site's own JSON API responses over parsing HTML.

## Run
```bash
cd scripts/crawl && npm install          # first time
node vegnonveg.mjs 50 ../../chosn-vegnonveg-prices.csv
python scripts/top_shopify_prices.py 50 chosn-top50-shopify-prices.csv
```

## Rules
- Keep concurrency low (<=3) and respect robots.txt/terms; do not scrape Amazon/Flipkart without proxies or an official API.
- Style code is the join key across stores: VegNonVeg exposes it as "Additional Information" on the product page; Shopify stores put it in the SKU, title, tags or description.
- Verify output by sampling rows and counting distinct product URLs per retailer before importing.
