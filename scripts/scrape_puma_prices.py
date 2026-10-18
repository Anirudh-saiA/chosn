r"""Puma India (in.puma.com) footwear into the CHOSN price-import CSV.

    python scripts/scrape_puma_prices.py [out.csv] [--limit N]        default: data/daily/<today>/puma.csv

Puma has no public product feed and shows each size's stock only after the page runs in a browser, so this reads the product
pages the site lists in its own sitemap, through Crawl4AI (a local browser, one session for the whole run). Rules from
scripts/webscraper/core.py apply: robots.txt checked for every URL, a User-Agent that says who we are, a pause between pages,
and a stop (not a workaround) if the site says no.

Per page: price and colour from its schema.org Product data, style number from the image path (307514/01 -> "307514 01"),
and one row per UK size from the size picker (data-disabled="true" means sold out). Pages that are not footwear are skipped.
A checkpoint file lets an interrupted run carry on instead of starting again.
"""
import asyncio
import csv
import datetime
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "webscraper"))
import core  # noqa: E402

BASE = "https://in.puma.com"
SITEMAP = f"{BASE}/sitemaps/urls/in/sitemap_index.xml"
COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping", "url", "in_stock",
           "image_url", "size_system", "condition"]
CHECKPOINT = os.path.join(ROOT, "data", "webscraper", "puma-checkpoint.jsonl")
# Slugs that are plainly not shoes: skipped without opening them (the page is checked again for "Footwear" anyway).
NOT_SHOES = re.compile(r"(^|-)(tee|t-shirt|tshirt|shirt|polo|jersey|shorts?|jacket|hoodie|sweatshirt|sweatpants|pants|trousers|"
                       r"tights|leggings|joggers?|track|tracksuit|vest|bra|dress|skirt|cap|beanie|hat|bag|backpack|socks?|"
                       r"gloves?|bottle|ball|towel|wristband|headband|sleeve|jacket|windbreaker|fleece|top|tank|singlet|"
                       r"bodysuit|romper|cover|mask|keyring|sunglasses|watch|belt|scarf|duffel|wallet|pouch|backpack)(-|$)")
DAY = datetime.date.today().isoformat()


def sitemap_urls():
    idx = core.polite_get(SITEMAP)
    urls = []
    for loc in re.findall(r"<loc>(.*?)</loc>", idx):
        urls += re.findall(r"<loc>(.*?)</loc>", core.polite_get(loc))
    # Style numbers starting 0, 5 or 6 are accessories and apparel (hairbands, tees, travel pants); shoes start 1, 3 or 4.
    return [u for u in dict.fromkeys(urls)
            if "/pd/" in u and not NOT_SHOES.search(u.rsplit("/", 2)[-2]) and u.rsplit("/", 1)[1][:1] in "134"]


def parse(url, html):
    """Rows for one page, or None when it is not footwear."""
    if not re.search(r'productDivision\\?"\s*:\s*\\?"Footwear', html):
        return None
    ld = None
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            d = json.loads(block)
        except ValueError:
            continue
        if isinstance(d, dict) and d.get("@type") == "Product":
            ld = d
            break
    if not ld:
        return []
    offer = ld.get("offers") or {}
    if isinstance(offer, list):
        offer = offer[0] if offer else {}
    price = offer.get("price")
    if not price:
        return []
    image = (ld.get("image") or [""])[0]
    m = re.search(r"/global/(\d{6})/(\d{2})/", image)
    code = f"{m.group(1)} {m.group(2)}" if m else ""
    name = re.sub(r"\s+", " ", ld.get("name") or "").strip()
    colour = re.sub(r"\s+", " ", (ld.get("color") or "")).strip().replace("PUMA ", "").replace("-", " / ")
    rows = []
    for block in re.split(r"<label ", html)[1:]:
        m = re.match(r'data-disabled="(true|false)" data-size="\d+"', block)
        s = re.search(r'data-content="size-value"[^>]*>\s*UK\s*([\d.]+)\s*<', block[:1500])
        if not m or not s:
            continue
        rows.append({
            "brand": "Puma", "model": name, "colorway": colour, "style_code": code, "size": s.group(1), "retailer": "Puma India",
            "price": int(float(price)), "shipping": "", "url": url, "in_stock": "no" if m.group(1) == "true" else "yes",
            "image_url": image, "size_system": "uk", "condition": "new",
        })
    return rows


def load_checkpoint():
    done = {}
    if os.path.exists(CHECKPOINT):
        for line in open(CHECKPOINT, encoding="utf-8"):
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if rec.get("day") == DAY:
                done[rec["url"]] = rec["rows"]
    return done


async def crawl(urls, done, limit):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

    cfg = CrawlerRunConfig(page_timeout=60000, delay_before_return_html=2.5, user_agent=core.USER_AGENT)
    os.makedirs(os.path.dirname(CHECKPOINT), exist_ok=True)
    out = open(CHECKPOINT, "a", encoding="utf-8")
    todo = [u for u in urls if u not in done][:limit]
    started = time.time()
    async with AsyncWebCrawler(config=BrowserConfig(headless=True, verbose=False)) as crawler:
        for i, url in enumerate(todo, 1):
            if not core.allowed(url):
                continue
            core.pace(url)
            try:
                res = await crawler.arun(url, config=cfg)
            except Exception as e:  # one bad page must not stop the run
                print(f"  skip {url}: {type(e).__name__}", flush=True)
                continue
            core.check_page(url, getattr(res, "status_code", 200) or 200, res.html or "")  # raises SiteBlocked
            rows = parse(url, res.html or "")
            done[url] = rows if rows is not None else []
            out.write(json.dumps({"day": DAY, "url": url, "rows": done[url]}) + "\n")
            out.flush()
            if i % 25 == 0:
                shoes = sum(1 for r in done.values() if r)
                print(f"{i}/{len(todo)} pages, {shoes} shoes, {int(time.time() - started)}s", flush=True)
    out.close()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 10 ** 9
    if limit != 10 ** 9:
        args = [a for a in args if a != str(limit)]
    out = args[0] if args else os.path.join(ROOT, "data", "daily", DAY, "puma.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    urls = sitemap_urls()
    print(f"{len(urls)} product pages to look at", flush=True)
    done = load_checkpoint()
    try:
        asyncio.run(crawl(urls, done, limit))
    except core.SiteBlocked as e:
        print(f"STOPPED: {e}. Nothing more is requested from this site; the pause lasts 24 h.")
        if not any(done.values()):
            return 3
    rows = [r for rs in done.values() for r in rs]
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"done: {len(rows)} rows, {sum(1 for r in done.values() if r)} shoes -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
