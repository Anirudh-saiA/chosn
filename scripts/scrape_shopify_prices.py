"""Scrape sneaker listings from Shopify-based Indian stores into the CHOSN price-import CSV format.

Usage: python scripts/scrape_shopify_prices.py [out.csv]
One row per size. Rows whose style code could not be determined are written to <out>-missing-style-code.csv.
"""
import csv
import html
import json
import re
import sys
import time
import os
import urllib.request

COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping",
           "url", "in_stock", "image_url", "size_system", "condition", "gallery_urls", "compare_at_price"]

STORES = [
    {"retailer": "Superkicks", "base": "https://www.superkicks.in"},
    {"retailer": "Crepdog Crew", "base": "https://crepdogcrew.com"},
]

# Nike/Jordan (DH9765-100), adidas (IE3437), New Balance (U9060ECA), Puma (384692 01), etc.
CODE_RES = [
    re.compile(r"\b([A-Z]{1,3}\d{4}-\d{3})\b"),
    re.compile(r"\b(\d{6}-\d{3})\b"),
    re.compile(r"\b([A-Z]{2}\d{4})\b"),
    re.compile(r"\b(\d{6} \d{2})\b"),
]


sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "webscraper"))
import core  # noqa: E402  (robots.txt, identified User-Agent, pacing, and a stop when a site says no)


def get(url):
    """Public product feed through the shared polite fetcher. A site that says no (HTTP 429/403) raises SiteBlocked, which
    stops that store instead of being mistaken for "no products"."""
    try:
        return core.polite_get(url, as_json=True)
    except OSError:
        return None


def fetch_products(base):
    out, page = [], 1
    while True:
        data = get(f"{base}/products.json?limit=250&page={page}")
        if not data or not data.get("products"):
            return out
        out += data["products"]
        page += 1


# Every kind of footwear, not just "sneakers": slides, clogs, sandals, boots, loafers, slippers ... Apparel, bags, caps and
# accessories are left out (they have no UK shoe sizes). "Flip Straw" / "Flip Top Mug" are drinkware, not flip-flops.
FOOTWEAR = re.compile(r"sneaker|shoe|footwear|slide|clog|sandal|boot|loafer|slipper|flip[ -]?flop|mule|trainer|runner|croc", re.I)
NOT_FOOTWEAR = re.compile(r"straw|mug|bottle|care|cleaner|protector|sock|bag|cap\b|hat|lace|cleaner|wipe|insole|shoe ?box|shoe ?tree|keychain|sticker", re.I)


# Sneakers only (founder decision 2026-10-27, card data-scope-slides): slides, sandals, flip-flops, slippers, clogs and mules
# are not collected. Old rows stay in the database as history.
NOT_SNEAKER = re.compile(r"\b(slides?|sliders?|sandals?|slippers?|clogs?|flip[ -]?flops?|mules?|thongs?|floaters?|crocs|adilette|"
                         r"leadcat|popcat)\b", re.I)


def is_non_sneaker_footwear(p):
    """True when the product type, title or tags name slides, sandals, flip-flops, slippers, clogs or mules."""
    return bool(NOT_SNEAKER.search(" ".join([p.get("product_type") or "", p.get("title") or "", " ".join(p.get("tags", []))])))


def is_sneaker(p):
    """True for sneaker-type footwear (slides, sandals, flip-flops, slippers, clogs and mules are excluded)."""
    ptype = (p.get("product_type") or "")
    tags = " ".join(p.get("tags", []))
    title = p.get("title") or ""
    if is_non_sneaker_footwear(p):
        return False
    if NOT_FOOTWEAR.search(ptype) or NOT_FOOTWEAR.search(title) and not FOOTWEAR.search(ptype):
        return False
    return bool(FOOTWEAR.search(ptype) or ("footwear" in tags.lower() and FOOTWEAR.search(tags)))


def find_style_code(p):
    text = " ".join([p["title"], " ".join(p.get("tags", [])), re.sub(r"<[^>]+>", " ", html.unescape(p.get("body_html") or ""))])
    for rx in CODE_RES:
        m = rx.search(text)
        if m:
            return m.group(1)
    return ""


def title_case(s):
    return " ".join(w if any(c.isdigit() for c in w) and w.isupper() and len(w) <= 3 else w.capitalize() for w in s.split())


def clean_size(v):
    s = re.sub(r"(?i)\b(uk|us|eu)\b", "", v).strip(" -/")
    return s


def normalize_brand(vendor):
    v = vendor.lower()
    for key, name in (("jordan", "Jordan"), ("nike", "Nike"), ("adidas", "adidas"), ("yeezy", "adidas"),
                      ("new balance", "New Balance"), ("puma", "Puma"), ("reebok", "Reebok"),
                      ("converse", "Converse"), ("asics", "ASICS"), ("vans", "Vans"), ("on", "On")):
        if v == key or v.startswith(key + " "):
            return name
    return vendor.title() if vendor.isupper() else vendor


def was_price(v):
    """The store's own "was" price (Shopify compare_at_price) when it is above today's price, else blank."""
    try:
        was, now = float(v.get("compare_at_price") or 0), float(v["price"])
    except (TypeError, ValueError):
        return ""
    return int(was) if was > now else ""


def rows_for(p, store):
    vendor = (p.get("vendor") or "").strip()
    brand = normalize_brand(vendor)
    title = p["title"].strip()
    title = re.sub(r"^[A-Za-z ]+\|\s*", "", title)  # "NIKE | AIR FORCE 1 ..." -> drop brand prefix
    if "{" in title:
        model, colorway = [x.strip() for x in title.split("{", 1)]
    else:
        model, colorway = title, ""
    color_opt = next((o for o in p["options"] if o["name"].lower() in ("color", "colour")), None)
    if not colorway and color_opt and color_opt["values"]:
        colorway = color_opt["values"][0].title()
    code = find_style_code(p)
    image = p["images"][0]["src"] if p.get("images") else ""
    gallery = "|".join(i["src"] for i in p.get("images", [])[:5])
    base_url = f"{store['base']}/products/{p['handle']}"
    out = []
    for v in p["variants"]:
        size = clean_size(v["title"].split("/")[-1].strip())
        sku = v.get("sku") or ""
        vcode = code
        if store["retailer"] == "Superkicks" and re.match(r"^[A-Z0-9]+(-\d{3})?-[\d.]+$", sku):
            vcode = sku.rsplit("-", 1)[0]
        out.append({
            "brand": brand, "model": model if store["retailer"] == "Superkicks" else title,
            "colorway": colorway, "style_code": vcode, "size": size, "retailer": store["retailer"],
            "price": int(float(v["price"])), "shipping": "", "url": base_url,
            "in_stock": "yes" if v["available"] else "no", "image_url": image,
            "size_system": "uk", "condition": "new", "gallery_urls": gallery, "compare_at_price": was_price(v),
        })
    return out


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "scraped-prices.csv"
    rows = []
    for store in STORES:
        try:
            prods = [p for p in fetch_products(store["base"]) if is_sneaker(p)]
        except core.SiteBlocked as e:  # keep nothing from this store rather than a half-read list
            print(f"{store['retailer']}: SKIPPED, {e}. The pause lasts 24 h (python scripts/webscraper/run.py status).")
            continue
        print(f"{store['retailer']}: {len(prods)} sneaker products")
        for p in prods:
            rows += rows_for(p, store)
    if not rows:
        print("nothing was read from any store")
        sys.exit(3)
    ok = [r for r in rows if r["style_code"]]
    missing = [r for r in rows if not r["style_code"]]
    for path, data in ((out_path, ok), (out_path.replace(".csv", "-missing-style-code.csv"), missing)):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(data)
    print(f"{len(ok)} rows with style code, {len(missing)} without")


if __name__ == "__main__":
    main()
