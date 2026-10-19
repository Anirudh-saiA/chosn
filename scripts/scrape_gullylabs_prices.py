r"""Gully Labs (gullylabs.com) sneakers into the CHOSN price-import CSV.

    python scripts/scrape_gullylabs_prices.py [out.csv]        default: data/daily/<today>/gullylabs.csv

Gully Labs is a one-brand Shopify store whose robots.txt allows /products.json. Read through scripts/webscraper/core.py (robots.txt
checked, identified User-Agent, 1.5 s between requests, a stop if the site says no). SKUs are "<style>_<EU size>"
(GL2_VIC_BLU_W_36), so the style code is the SKU without its size, with "-" for "_". Only product type "Sneakers" is kept.
Prices are per UK size.
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

BASE = "https://gullylabs.com"
COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping", "url", "in_stock",
           "image_url", "size_system", "condition", "gallery_urls"]
SIZE_SUFFIX = re.compile(r"_(\d{2})$")
CODE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)+$")


def style_code(sku):
    code = SIZE_SUFFIX.sub("", (sku or "").strip().upper()).replace("_", "-")
    return code if CODE.match(code) and not code.isdigit() else ""


def clean_size(title):
    m = re.search(r"(\d{1,2}(?:\.5)?)", title)
    return m.group(1) if m else ""


def rows_for(p):
    title = re.sub(r"\s+", " ", p["title"]).strip()
    image = p["images"][0]["src"] if p.get("images") else ""
    gallery = "|".join(i["src"] for i in p.get("images", [])[:5])
    out = []
    for v in p["variants"]:
        size = clean_size(v["title"])
        if not size:
            continue
        out.append({
            "brand": "Gully Labs", "model": title, "colorway": "", "style_code": style_code(v.get("sku")), "size": size,
            "retailer": "Gully Labs", "price": int(float(v["price"])), "shipping": "", "url": f"{BASE}/products/{p['handle']}",
            "in_stock": "yes" if v.get("available") else "no", "image_url": image, "size_system": "uk", "condition": "new",
            "gallery_urls": gallery,
        })
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "daily", datetime.date.today().isoformat(), "gullylabs.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    rows, shoes, page = [], 0, 1
    try:
        while page <= 100:
            batch = core.polite_get(f"{BASE}/products.json?limit=250&page={page}", as_json=True).get("products", [])
            if not batch:
                break
            for p in batch:
                if (p.get("product_type") or "").strip().lower() != "sneakers":
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
