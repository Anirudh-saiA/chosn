r"""Culture Circle (culture-circle.com) footwear into the CHOSN price-import CSV.

    python scripts/scrape_culturecircle_prices.py [out.csv] [--minutes N]      default: data/daily/<today>/culturecircle.csv, 90 min

Culture Circle is an authenticated-resale marketplace with about 10,000 India product pages in its sitemap. Each page carries a
schema.org Product with one Offer per UK size (price, in stock or not) plus the store's stated delivery and return terms, so plain
HTTP is enough. robots.txt allows the pages (it disallows /api/ and checkout, which this never touches). Read through
scripts/webscraper/core.py: robots.txt checked, identified User-Agent, a pause between pages, a stop if the site says no.

Reading every page takes about 5 hours, so each run works for --minutes and carries on from where the last one stopped
(never-read pages first, then the oldest). Every page's rows are kept in data/webscraper/cc-checkpoint.jsonl; the CSV holds
all rows read in the last 14 days, so a half-finished pass still imports everything fetched so far. Pages that are not footwear are
remembered and only looked at again after 30 days.
"""
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

BASE = "https://www.culture-circle.com"
SITEMAP_PARTS = ["https://www.culture-circle.com/sitemaps/sitemap-products-in-1-f8b9d2bbc3d6488292d52a13baf65189-repair-"
                 "4c703db9f2cf4bd284deeb19b01c89c6-child-part-%d.xml" % i for i in (1, 2, 3)]
COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping", "url", "in_stock",
           "image_url", "size_system", "condition", "delivery_time", "gallery_urls"]
CHECKPOINT = os.path.join(ROOT, "data", "webscraper", "cc-checkpoint.jsonl")
URL_CACHE = os.path.join(ROOT, "data", "webscraper", "cc-urls.json")
FRESH_DAYS = 14        # rows older than this are no longer imported
NOT_SHOE_DAYS = 30     # how long a non-footwear page is left alone
BRANDS = {"air jordan": "Jordan", "jordan brand": "Jordan", "on running": "On", "hoka one one": "Hoka", "adidas originals": "adidas",
          "adidas": "adidas", "asics": "ASICS", "new balance": "New Balance", "nike": "Nike", "puma": "Puma"}
NOW = time.time()


def product_urls():
    """India product pages from the sitemap, cached for a day."""
    if os.path.exists(URL_CACHE) and NOW - os.path.getmtime(URL_CACHE) < 86400:
        return json.load(open(URL_CACHE))
    urls = []
    for part in SITEMAP_PARTS:
        urls += re.findall(r"<ns0:loc>(.*?)</ns0:loc>", core.polite_get(part))
    urls = list(dict.fromkeys(u for u in urls if "/products/" in u))
    os.makedirs(os.path.dirname(URL_CACHE), exist_ok=True)
    json.dump(urls, open(URL_CACHE, "w"))
    return urls


def load_checkpoint():
    state = {}
    if os.path.exists(CHECKPOINT):
        for line in open(CHECKPOINT, encoding="utf-8"):
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            state[rec["url"]] = rec
    return state


def valid_size(text):
    """UK sizes are whole or half numbers between 1 and 17; a page with "UK5.56" or "UK639" is a data slip, not a size."""
    try:
        v = float(text)
    except ValueError:
        return False
    return 1 <= v <= 17 and (v * 2).is_integer()


def days_text(offer_block):
    """'Delivery in 3-8 days' from the store's own handling + transit times."""
    try:
        sd = offer_block["shippingDetails"]["deliveryTime"]
        lo = sd["handlingTime"]["minValue"] + sd["transitTime"]["minValue"]
        hi = sd["handlingTime"]["maxValue"] + sd["transitTime"]["maxValue"]
        return f"Delivery in {lo}-{hi} days"
    except (KeyError, TypeError):
        return ""


def parse(url, html):
    """(is_footwear, rows) for one product page."""
    product = None
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            d = json.loads(block)
        except ValueError:
            continue
        if isinstance(d, dict) and d.get("@type") == "Product":
            product = d
            break
    if not product:
        return False, []
    category = (product.get("category") or "").lower()
    if "footwear" not in category and "shoe" not in category and "sneaker" not in category:
        return False, []
    agg = product.get("offers") or {}
    offers = agg.get("offers") or []
    vendor = ((product.get("brand") or {}).get("name") or "").strip()
    brand = BRANDS.get(vendor.lower(), vendor)
    name = re.sub(r"\s+", " ", product.get("name") or "").strip()
    colour = re.sub(r"\s+", " ", product.get("color") or "").strip()
    model = re.sub(rf"^{re.escape(vendor)}\s+", "", name, flags=re.I) if vendor else name
    if colour and model.lower().endswith(colour.lower()) and len(model) > len(colour):
        model = model[: -len(colour)].strip()
    imgs = product.get("image") if isinstance(product.get("image"), list) else [product.get("image") or ""]
    image = imgs[0] if imgs else ""
    gallery = "|".join(u for u in imgs[:5] if isinstance(u, str) and u.startswith("https://"))
    delivery = days_text(agg)
    rows = []
    for o in offers:
        m = re.match(r"^UK\s*([\d.]+)$", (o.get("name") or "").strip(), re.I)
        if not m or not o.get("price") or not valid_size(m.group(1)):
            continue
        rows.append({
            "brand": brand, "model": model, "colorway": colour, "style_code": "", "size": m.group(1), "retailer": "Culture Circle",
            "price": int(float(o["price"])), "shipping": "", "url": url,
            "in_stock": "yes" if str(o.get("availability", "")).endswith("InStock") else "no",
            "image_url": image, "size_system": "uk", "condition": "new", "delivery_time": delivery, "gallery_urls": gallery,
        })
    return True, rows


def main():
    argv = sys.argv[1:]
    minutes = 90.0
    if "--minutes" in argv:
        i = argv.index("--minutes")
        minutes = float(argv[i + 1])
        del argv[i : i + 2]
    out = argv[0] if argv else os.path.join(ROOT, "data", "daily", datetime.date.today().isoformat(), "culturecircle.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    urls = product_urls()
    state = load_checkpoint()
    print(f"{len(urls)} product pages, {len(state)} already read", flush=True)

    def due(u):
        rec = state.get(u)
        if rec is None:
            return (0, 0)
        age = NOW - rec["at"]
        if rec.get("shoe") is False:
            return (2, rec["at"]) if age > NOT_SHOE_DAYS * 86400 else None
        return (1, rec["at"])  # shoes: oldest first

    queue = sorted((k for k in ((due(u), u) for u in urls) if k[0] is not None), key=lambda k: k[0])
    deadline = time.time() + minutes * 60
    os.makedirs(os.path.dirname(CHECKPOINT), exist_ok=True)
    fh = open(CHECKPOINT, "a", encoding="utf-8")
    done = 0
    try:
        for _, u in queue:
            if time.time() > deadline:
                break
            try:
                html = core.polite_get(u)
            except core.SiteBlocked:
                raise
            except Exception as e:  # one missing or broken page must not stop the pass
                print(f"  skip {u}: {type(e).__name__}", flush=True)
                continue
            shoe, rows = parse(u, html)
            state[u] = {"url": u, "at": time.time(), "shoe": shoe, "rows": rows}
            fh.write(json.dumps(state[u]) + "\n")
            fh.flush()
            done += 1
            if done % 50 == 0:
                print(f"{done} pages read this run ({sum(1 for r in state.values() if r.get('rows'))} shoes known)", flush=True)
    except core.SiteBlocked as e:
        print(f"STOPPED: {e}. Nothing more is requested from this site; the pause lasts 24 h (python scripts/webscraper/run.py status).")
    fh.close()

    cutoff = NOW - FRESH_DAYS * 86400
    rows = [r for rec in state.values() if rec.get("rows") and rec["at"] >= cutoff for r in rec["rows"] if valid_size(r["size"])]
    if not rows:
        print("nothing read yet")
        return 3
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"done: {done} pages this run, {len(rows)} rows from {len({r['url'] for r in rows})} shoes -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
