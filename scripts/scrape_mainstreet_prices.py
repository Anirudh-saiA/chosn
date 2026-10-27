r"""Mainstreet Marketplace (marketplace.mainstreet.co.in) sneakers into the CHOSN price-import CSV.

    python scripts/scrape_mainstreet_prices.py [out.csv]        default: data/daily/<today>/mainstreet.csv

It is a Shopify storefront whose robots.txt allows public product pages and whose agent guide invites read-only browsing, so
this reads its public collection feed (/collections/sneakers/products.json) through scripts/webscraper/core.py: robots.txt
checked, a User-Agent that says who we are, 1.5 s between requests, and a stop (not a workaround) if the site says no.

The store imports shoes to order (its listings say "Ships in 28 days") and prices them in rupees, so these are real INR
prices a shopper in India pays. Style codes come from the SKU when it looks like one; the rest go through pair_products.py.
Only footwear is kept (the collection also holds apparel). Prices are per UK size; in_stock is the store's own "available".
"""
import csv
import datetime
import os
import re
import sys
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "webscraper"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import core  # noqa: E402
from scrape_shopify_prices import normalize_brand, is_non_sneaker_footwear  # noqa: E402

BASE = "https://marketplace.mainstreet.co.in"
COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping", "url", "in_stock",
           "image_url", "size_system", "condition", "delivery_time", "gallery_urls", "compare_at_price"]
FOOT = re.compile(r"sneaker|shoe|slide|clog|sandal|boot|loafer|slipper|mule|trainer|runner", re.I)
NOT_FOOT = re.compile(r"\b(tee|t-shirt|tshirt|hoodie|jacket|pants|shorts|socks?|cap|hat|bag|backpack|watch|belt|sweat|jersey|denim|jeans)\b", re.I)
CODE = re.compile(r"^[A-Z0-9]{5,}(?:-[A-Z0-9]{2,4})?$")


COLLECTIONS = ["sneakers", "all-sneakers", "nike", "adidas", "new-balance", "air-jordan", "on", "hoka", "asics", "salomon",
               "saucony", "puma", "converse", "vans", "reebok", "mizuno", "timberland", "yeezy", "dunks", "dunk-lows",
               "jordan-1-lows", "jordan-1-mids", "jordan-1-highs", "basketball-shoes", "thrift-shoes", "adidas-xlg"]


def is_footwear(p):
    if is_non_sneaker_footwear(p):  # sneakers only (founder decision 2026-10-27): no slides, sandals, flip-flops, slippers, clogs
        return False
    tags = [t.lower() for t in p.get("tags", [])]
    ptype = (p.get("product_type") or "")
    if NOT_FOOT.search(p["title"]) and "sneakers" not in tags:
        return False
    return "sneakers" in tags or bool(FOOT.search(ptype))


def style_code(p, sku):
    sku = (sku or "").strip().upper()
    return sku if CODE.match(sku) and not sku.isdigit() else ""


# Mainstreet lists a lot of one-off pairs. A shoe with fewer than this many sizes in stock is not a shoe people can shop
# for, so it is left out (it would only add noise to browse and search).
MIN_SIZES_IN_STOCK = 4


def was_price(v):
    """The store's own "was" price (Shopify compare_at_price) when it is above today's price, else blank."""
    try:
        was, now = float(v.get("compare_at_price") or 0), float(v["price"])
    except (TypeError, ValueError):
        return ""
    return int(was) if was > now else ""


def rows_for(p):
    brand = normalize_brand((p.get("vendor") or "").strip())
    title = re.sub(r"\s+", " ", p["title"]).strip()
    model = re.sub(rf"^{re.escape(brand)}\s+", "", title, flags=re.I) or title
    image = p["images"][0]["src"] if p.get("images") else ""
    gallery = "|".join(i["src"] for i in p.get("images", [])[:5])  # the feed already lists every photo: no extra requests
    out = []
    for v in p["variants"]:
        size = re.sub(r"(?i)^\s*uk\s*", "", v["title"].split("/")[0]).strip()
        out.append({
            "brand": brand, "model": model, "colorway": "", "style_code": style_code(p, v.get("sku")), "size": size,
            "retailer": "Mainstreet Marketplace", "price": int(float(v["price"])), "shipping": "",
            "url": f"{BASE}/products/{p['handle']}", "in_stock": "yes" if v.get("available") else "no", "image_url": image,
            "size_system": "uk", "condition": "new", "delivery_time": "Ships in about 28 days (imported to order)", "gallery_urls": gallery, "compare_at_price": was_price(v),
        })
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "daily", datetime.date.today().isoformat(), "mainstreet.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    rows, seen = [], set()
    # One collection feed stops at 100 pages (25,000 products), and the "sneakers" feed is bigger than that, so the brand and
    # style collections are read as well; products are de-duplicated by id.
    try:
        for handle in COLLECTIONS:
            page, got = 1, 0
            while page <= 100:
                try:
                    d = core.polite_get(f"{BASE}/collections/{handle}/products.json?limit=250&page={page}", as_json=True)
                except urllib.error.HTTPError as e:
                    if e.code in (400, 404):  # no such collection / past its last page
                        break
                    raise
                batch = d.get("products", [])
                if not batch:
                    break
                for p in batch:
                    if p["id"] in seen or not is_footwear(p):
                        continue
                    if sum(1 for v in p["variants"] if v.get("available")) < MIN_SIZES_IN_STOCK:
                        seen.add(p["id"])
                        continue
                    seen.add(p["id"])
                    got += 1
                    rows += rows_for(p)
                page += 1
            print(f"{handle}: {page - 1} page(s), {got} new shoes, {len(seen)} total", flush=True)
    except (OSError, ValueError) as e:  # a network error that survived the retries: keep what was read so far
        print(f"STOPPED: {type(e).__name__}: {e}. Writing the {len(seen)} shoes read so far.")
    except core.SiteBlocked as e:
        print(f"STOPPED: {e}. Nothing more is requested from this site; the pause lasts 24 h (python scripts/webscraper/run.py status).")
        if not rows:
            return 3
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"done: {len(rows)} rows, {len(seen)} shoes -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
