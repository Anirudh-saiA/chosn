---
name: webscraper
description: Scrape store websites for CHOSN (sneaker prices, sizes, images, offers, ratings). Use when asked to scrape or re-scrape a store, add a new store, read one web page, or run the daily scrape. Covers the tool chain (plain HTTP, Crawl4AI, Scrapling, Firecrawl, Browser Use), the fallback rule and the rules every scrape must follow.
---

# CHOSN webscraper

One toolkit, one set of rules. Code: `scripts/webscraper/` (`core.py` rules, `engines.py` tools, `run.py` command line).
Own Python environment: `tools/webscraper-venv` (the runner switches to it by itself).

## Run it

```
python scripts/webscraper/run.py tools              # which tools are ready / paused
python scripts/webscraper/run.py fetch <url>        # read one page with the first tool that works
python scripts/webscraper/run.py jobs               # shopify | vegnonveg | myntra | mainstreet
python scripts/webscraper/run.py job mainstreet     # one store
python scripts/webscraper/run.py all                # whole update: every store, pairing, import, offers, ratings
python scripts/webscraper/run.py status             # paused tools and paused sites
python scripts/webscraper/run.py reset              # clear every pause
npm run scrape                                      # same as "all"
```
`all` takes 2 hours or more because Myntra is read at one page per second. Add `--skip-myntra` or `--skip-mainstreet` to leave one out.

## The tool chain (tried in this order)

1. `http` plain HTTP (public JSON feeds, server-rendered pages). Fast, no limits.
2. `crawl4ai` (github.com/unclecode/crawl4ai) local browser rendering to HTML and markdown. Free.
3. `scrapling` (github.com/D4Vinci/Scrapling) local fetcher. Free. Its stealth fetcher is NOT used.
4. `firecrawl` (github.com/firecrawl/firecrawl) hosted API; needs `FIRECRAWL_API_KEY` (or `FIRECRAWL_API_URL` for a self-hosted copy). Has a credit allowance.
5. `browser-use` (github.com/browser-use/browser-use) an AI agent drives a browser. Needs `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. Costs per run, so it goes last.

A tool that is not installed, has no key, hits its quota or crashes is **switched off for 6 hours** and the next tool takes over. A page that is empty without JavaScript also moves on to a rendering tool. That is the fallback.

## Rules (not optional)

- **A site that says no stops the scrape of that site.** HTTP 401/403/429 that persists, a CAPTCHA or bot challenge, a login wall, a "free views expired" wall, or a `robots.txt` Disallow pauses that site for 24 hours. Do NOT retry it with another tool, a proxy, rotated sessions, cleared cookies, stealth modes or a CAPTCHA solver. Limits on a *tool* are worked around by switching tools; limits on a *site* are respected.
- `robots.txt` is checked for every URL; requests carry the CHOSN User-Agent; at least 1.5 s between requests to one domain (longer if the site asks); back off on 429.
- Public pages only. Never log in, fill forms, add to cart or touch checkout. No personal data.
- Prefer a store's public product feed (`/products.json`, `/collections/<handle>/products.json`) over scraping HTML.
- Read a store's own policy / FAQ pages for delivery, returns and payment facts. State only what the store states, with the source and the date. No invented offers or reviews.

## Adding a store

1. Check `robots.txt`, find the public product feed, look at a few products (sizes in UK? style code in the SKU?).
2. Write `scripts/scrape_<store>_prices.py` that reads through `core.polite_get` and writes the standard price CSV (see `scrape_mainstreet_prices.py`). Rows with no style code go through `pair_products.py`.
3. Add a migration that inserts the retailer (logo in `apps/web/public/stores/`, delivery, returns, shipping facts and source URLs) and add its offers and payment options to `scripts/offers/curated_offers.json`.
4. Register the job in `run.py` and `daily_update.py`.

## Known limits

- StockX: not scraped (robots.txt disallows its API; product pages sit behind a free-view limit). Use a link-out or a licensed price API.
- Shopify collection feeds stop at 100 pages (25,000 products): read the brand and style collections too and de-duplicate by product id.
- Myntra shows only page 1 of each brand/category listing without its app API, and gives no style code.
