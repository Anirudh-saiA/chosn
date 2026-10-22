r"""Limited Edt (limitededt.in) footwear into the CHOSN price-import CSV.

    python scripts/scrape_limitededt_prices.py [out.csv]        default: data/daily/<today>/limitededt.csv

A Shopify storefront whose robots.txt allows /products.json. Read through scripts/webscraper/core.py: robots.txt checked, a
User-Agent that says who we are, 1.5 s between requests, and a stop (not a workaround) if the site says no. Its policy pages
are disallowed by robots.txt, so nothing about delivery or returns is read or claimed.

SKUs are "<style code>-<size>" (DQ8426-005-6, IH4208-3.5), so the style code is the SKU without its size. Titles are
"<model> '<colourway>'". Only footwear is kept (the feed also holds apparel and caps). Prices are per UK size.
"""
import csv
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "webscraper"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import core  # noqa: E402
from scrape_shopify_prices import normalize_brand  # noqa: E402

BASE = "https://limitededt.in"
COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping", "url", "in_stock",
           "image_url", "size_system", "condition", "gallery_urls", "compare_at_price"]
SIZE_SUFFIX = re.compile(r"-(\d{1,2}(?:\.5)?)(?:EU\d+)?$")
CODE = re.compile(r"^[A-Z0-9]{5,}(?:-[A-Z0-9]{2,4})?$")
BRANDS = {"jordan brand": "Jordan", "adidas originals": "adidas", "asics": "ASICS", "new balance": "New Balance"}


def style_code(sku):
    code = SIZE_SUFFIX.sub("", (sku or "").strip().upper())
    return code if CODE.match(code) and not code.isdigit() else ""


def clean_size(title):
    m = re.search(r"(\d{1,2}(?:\.5)?)", title)
    return m.group(1) if m else ""


def was_price(v):
    """The store's own "was" price (Shopify compare_at_price) when it is above today's price, else blank."""
    try:
        was, now = float(v.get("compare_at_price") or 0), float(v["price"])
    except (TypeError, ValueError):
        return ""
    return int(was) if was > now else ""


def rows_for(p):
    vendor = (p.get("vendor") or "").strip()
    brand = BRANDS.get(vendor.lower()) or normalize_brand(vendor)
    title = re.sub(r"\s+", " ", p["title"]).strip()
    m = re.match(r"^(.*?)\s*'(.+)'\s*$", title)
    model, colorway = (m.group(1).strip(), m.group(2).strip().title()) if m else (title, "")
    model = re.sub(r"^Wmns\s+", "Wmns ", model, flags=re.I)
    image = p["images"][0]["src"] if p.get("images") else ""
    gallery = "|".join(i["src"] for i in p.get("images", [])[:5])
    out = []
    for v in p["variants"]:
        size = clean_size(v["title"])
        if not size:
            continue
        out.append({
            "brand": brand, "model": model or title, "colorway": colorway, "style_code": style_code(v.get("sku")), "size": size,
            "retailer": "Limited Edt", "price": int(float(v["price"])), "shipping": "", "url": f"{BASE}/products/{p['handle']}",
            "in_stock": "yes" if v.get("available") else "no", "image_url": image, "size_system": "uk", "condition": "new",
            "gallery_urls": gallery, "compare_at_price": was_price(v),
        })
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "daily", datetime.date.today().isoformat(), "limitededt.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    rows, shoes, page = [], 0, 1
    try:
        while page <= 100:
            batch = core.polite_get(f"{BASE}/products.json?limit=250&page={page}", as_json=True).get("products", [])
            if not batch:
                break
            for p in batch:
                if (p.get("product_type") or "").strip().lower() != "footwear":
                    continue
                shoes += 1
                rows += rows_for(p)
            print(f"page {page}: {len(batch)} products, {shoes} shoes so far", flush=True)
            page += 1
    except (OSError, ValueError) as e:
        print(f"STOPPED: {type(e).__name__}: {e}. Writing the {shoes} shoes read so far.")
    except core.SiteBlocked as e:
        print(f"STOPPED: {e}. Nothing more is requested from this site; the pause lasts 24 h (python scripts/webscraper/run.py status).")
        if not rows:
            return 3
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    coded = sum(1 for r in rows if r["style_code"])
    print(f"done: {len(rows)} rows, {shoes} shoes, {coded} rows with a style code -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
