"""Top-N best-selling in-stock sneakers per Shopify store, in the CHOSN price-import CSV format.

Best-selling order comes from the store's collection page (?sort_by=best-selling), because
/products.json ignores sort_by. Product data comes from /products.json via scrape_shopify_prices.

Usage: python scripts/top_shopify_prices.py [N=50] [out.csv]
"""
import csv
import re
import sys
import time
import urllib.request

sys.path.insert(0, __file__.rsplit("scripts", 1)[0] + "scripts")
from scrape_shopify_prices import COLUMNS, fetch_products, is_sneaker, rows_for  # noqa: E402

STORES = [
    {"retailer": "Superkicks", "base": "https://www.superkicks.in", "collection": "all-products"},
    {"retailer": "Crepdog Crew", "base": "https://crepdogcrew.com", "collection": "sneakers"},
]


def ranked_handles(store, want, max_pages=12):
    seen, order = set(), []
    for page in range(1, max_pages + 1):
        url = f"{store['base']}/collections/{store['collection']}?sort_by=best-selling&page={page}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            html = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
        except Exception:
            break
        found = [h for h in re.findall(r'href="(?:/collections/[^"/]+)?/products/([a-z0-9][a-z0-9\-_%]*)', html) if h not in seen]
        if not found:
            break
        for h in found:
            if h not in seen:
                seen.add(h)
                order.append(h)
        if len(order) >= want:
            break
        time.sleep(0.5)
    return order


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    out_path = sys.argv[2] if len(sys.argv) > 2 else "chosn-top-prices.csv"
    ok, missing = [], []
    for store in STORES:
        by_handle = {p["handle"]: p for p in fetch_products(store["base"])}
        picked = 0
        for handle in ranked_handles(store, n * 6):
            p = by_handle.get(handle)
            if not p or not is_sneaker(p) or not any(v["available"] for v in p["variants"]):
                continue
            rows = [r for r in rows_for(p, store) if r["in_stock"] == "yes"]
            (ok if rows and rows[0]["style_code"] else missing).extend(rows)
            picked += 1
            if picked >= n:
                break
        print(f"{store['retailer']}: {picked} sneakers")
    for path, data in ((out_path, ok), (out_path.replace(".csv", "-missing-style-code.csv"), missing)):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(data)
    print(f"{len(ok)} rows with style code, {len(missing)} without -> {out_path}")


if __name__ == "__main__":
    main()
