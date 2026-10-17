"""Scrape Myntra brand sneaker listings (price + per-size stock) into the CHOSN price-import CSV.

Myntra embeds each listing page's products as JSON in `window.__myx`, so plain HTTP is enough.
Myntra exposes no manufacturer style code (only its own Style ID) and its delivery estimate comes from a
pincode API that robots.txt disallows, so style_code is blank and delivery_time says so.

Besides the price CSV it writes <out>-ratings.json: every product's Myntra rating and rating count (the listing page
carries them, so this costs no extra requests) plus its MRP, keyed by the product URL. The importer maps the URL to the shoe.

Usage: python scripts/scrape_myntra_prices.py [out.csv]
"""
import csv
import json
import os
import re
import sys
import time
import urllib.request

COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping",
           "url", "in_stock", "image_url", "size_system", "condition", "delivery_time"]
BRANDS = ["nike", "adidas", "puma", "new-balance", "reebok", "converse", "vans", "asics", "skechers", "jordan"]
DELIVERY = "Varies by pincode (not published without one)"
SLUGS = ["{b}-sneakers", "men-{b}-sneakers", "women-{b}-sneakers", "{b}-casual-shoes", "men-{b}-casual-shoes",
         "women-{b}-casual-shoes", "{b}-sports-shoes", "men-{b}-sports-shoes", "women-{b}-sports-shoes"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36",
                                               "Accept-Language": "en-IN"})
    for attempt in range(3):
        try:
            return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
        except Exception:
            time.sleep(3 * (attempt + 1))
    return ""


def listing_products(url):
    m = re.search(r"window\.__myx\s*=\s*(\{.*?\})\s*</script>", get(url), re.S)
    if not m:
        return []
    try:
        return json.loads(m.group(1))["searchData"]["results"]["products"]
    except (KeyError, ValueError):
        return []


def pdp_sizes(landing):
    """Per-size availability from the product page (the listing's inventoryInfo is only a partial list)."""
    m = re.search(r"window\.__myx\s*=\s*(\{.*?\})\s*</script>", get("https://www.myntra.com/" + landing), re.S)
    if not m:
        return None
    try:
        sizes = json.loads(m.group(1))["pdpData"]["sizes"]
    except (KeyError, ValueError):
        return None
    return {re.sub(r"(?i)^uk", "", str(z["label"])).strip(): bool(z.get("available")) for z in sizes}


def meta_for(p):
    """Rating, rating count and MRP as Myntra shows them on the listing (None when Myntra shows none)."""
    count = int(p.get("ratingCount") or 0)
    return {
        "url": "https://www.myntra.com/" + p["landingPageUrl"],
        "rating": round(float(p["rating"]), 2) if p.get("rating") and count else None,
        "ratingCount": count or None,
        "mrp": int(p["mrp"]) if p.get("mrp") else None,
    }


def rows_for(p):
    brand = p["brand"]
    name = re.sub(r"\s+", " ", p["productName"]).strip()
    model = re.sub(rf"^{re.escape(brand)}\s+", "", name, flags=re.I)
    stock = pdp_sizes(p["landingPageUrl"])
    time.sleep(1)
    if not stock:
        return []  # no verified stock info -> don't guess
    sizes = list(stock)
    image = (p.get("searchImage") or "").replace("http://", "https://")
    return [{
        "brand": brand, "model": model, "colorway": (p.get("primaryColour") or "").title(), "style_code": "",
        "size": s, "retailer": "Myntra", "price": int(p["price"]), "shipping": "",
        "url": "https://www.myntra.com/" + p["landingPageUrl"], "in_stock": "yes" if stock[s] else "no",
        "image_url": image, "size_system": "uk", "condition": "new", "delivery_time": DELIVERY,
    } for s in sizes]


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "chosn-myntra-prices.csv"
    # Checkpoint: one JSON line per finished product, so a stopped run resumes where it left off.
    ckpt = out_path.replace(".csv", ".partial.jsonl")
    seen, rows, metas = set(), [], {}
    if os.path.exists(ckpt):
        for line in open(ckpt, encoding="utf-8"):
            rec = json.loads(line)
            seen.add(rec["id"])
            rows += rec["rows"]
            if rec.get("meta"):
                metas[rec["id"]] = rec["meta"]
        print(f"resuming: {len(seen)} products already done", flush=True)
    # Myntra only server-renders page 1 of a listing (later pages come from an internal API we don't use),
    # so widen coverage with gender/category variants of each brand page instead of paginating.
    for brand in BRANDS:
        for slug in SLUGS:
            path = slug.format(b=brand)
            new = [p for p in listing_products(f"https://www.myntra.com/{path}") if p["productId"] not in seen]
            for p in new:
                seen.add(p["productId"])
                got = rows_for(p)
                rows += got
                meta = meta_for(p) if got else None
                if meta:
                    metas[p["productId"]] = meta
                with open(ckpt, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": p["productId"], "rows": got, "meta": meta}) + "\n")
            print(f"{path}: {len(new)} new, {len(seen)} total", flush=True)
            time.sleep(1.5)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    with open(out_path.replace(".csv", "-ratings.json"), "w", encoding="utf-8") as f:
        json.dump(list(metas.values()), f, ensure_ascii=False)
    print(f"{sum(1 for m in metas.values() if m['rating'])} of {len(metas)} products have a Myntra rating")
    print(f"done: {len(rows)} rows, {len(seen)} products -> {out_path}")


if __name__ == "__main__":
    main()
