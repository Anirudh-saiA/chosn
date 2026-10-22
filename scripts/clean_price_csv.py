"""Make a scraped price CSV acceptable to the price importer.

The importer validates every row and saves nothing if one is bad, and it keys sneakers by
style code. So this script:
  - drops rows with no style code (they cannot be matched to a sneaker; written to <out>-dropped.csv)
  - drops rows with no usable price (a blank price would make the importer reject the whole night)
  - turns sizes like "6(EU39)" into 6, and drops kids / range sizes ("10-11Y") and impossible ones ("44318")
  - fills an empty colorway with "Default"
  - spells each brand one way (ADIDAS / Adidas / adidas -> adidas)
  - keeps one row per (store, style code, size), preferring an in-stock row

Usage: python scripts/clean_price_csv.py in.csv out.csv
"""
import csv
import re
import sys
from collections import Counter

BRAND_FIXES = {"adidas originals": "adidas", "adidas": "adidas", "asics": "ASICS", "new balance": "New Balance",
               "on": "On", "on running": "On", "jordan": "Jordan", "air jordan": "Jordan"}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    rows = list(csv.DictReader(open(src, encoding="utf-8")))
    cols = list(rows[0].keys())

    spelling = Counter(r["brand"] for r in rows)
    canonical = {}
    for brand, _ in spelling.most_common():  # most common spelling wins
        canonical.setdefault(brand.casefold(), brand)

    kept, dropped, best = [], [], {}
    for r in rows:
        r["style_code"] = r["style_code"].strip()
        m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*(?:\(.*\))?\s*$", r["size"])
        if not r["style_code"] or not m or not 1 <= float(m.group(1)) <= 20:  # 44318 etc. are spreadsheet date corruption
            dropped.append(r)
            continue
        if not re.match(r"^\s*\d+(?:\.\d+)?\s*$", r["price"]) or float(r["price"]) <= 0:  # a page that showed no price (seen on VegNonVeg 2026-10-21)
            dropped.append(r)
            continue
        r["size"] = m.group(1)
        if not r["model"].strip():  # a title that is only "{ NAME": the name is the model
            r["model"], r["colorway"] = r["colorway"].strip(), ""
        r["colorway"] = r["colorway"].strip() or "Default"
        if not r["model"].strip():
            dropped.append(r)
            continue
        key = r["brand"].strip().casefold()
        r["brand"] = BRAND_FIXES.get(key, canonical.get(key, r["brand"].strip()))
        k = (r["retailer"], r["style_code"], r["size"])
        old = best.get(k)
        if old is None or (old["in_stock"] != "yes" and r["in_stock"] == "yes"):
            best[k] = r
    kept = list(best.values())

    for path, data in ((dst, kept), (dst.replace(".csv", "-dropped.csv"), dropped)):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(data)
    by_store = Counter(r["retailer"] for r in kept)
    print(f"{len(rows)} rows read; {len(kept)} kept, {len(dropped)} dropped (no style code / unusable size / no price)")
    print("kept per store:", dict(by_store))
    print("distinct sneakers:", len({r["style_code"] for r in kept}))


if __name__ == "__main__":
    main()
