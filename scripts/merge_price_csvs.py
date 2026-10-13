"""Merge all scraped CHOSN price CSVs (plus Myntra's partial checkpoint) into one file, deduped on retailer+url+size.
Usage: python scripts/merge_price_csvs.py [out.csv]
"""
import csv
import glob
import json
import os
import sys

COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping",
           "url", "in_stock", "image_url", "size_system", "condition", "delivery_time"]
SKIP = {"chosn-prices-template.csv"}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "chosn-all-prices.csv"
    merged, per_file = {}, {}
    partial = "chosn-myntra-prices.partial.jsonl"
    # The checkpoint is the source of truth for Myntra (the CSV is only written when a run finishes).
    if os.path.exists(partial):
        SKIP.add("chosn-myntra-prices.csv")
    sources = [f for f in sorted(glob.glob("chosn-*prices*.csv")) if f not in SKIP and f != out]
    for f in sources:
        n = 0
        for r in csv.DictReader(open(f, encoding="utf-8")):
            merged[(r["retailer"], r["url"], r["size"])] = {c: r.get(c, "") for c in COLUMNS}  # later files win
            n += 1
        per_file[f] = n
    if os.path.exists(partial):
        n = 0
        for line in open(partial, encoding="utf-8"):
            for r in json.loads(line)["rows"]:
                merged[(r["retailer"], r["url"], r["size"])] = {c: r.get(c, "") for c in COLUMNS}
                n += 1
        per_file[partial] = n
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(merged.values())
    for f, n in per_file.items():
        print(f"{n:>7}  {f}")
    print(f"{len(merged):>7}  merged (deduped) -> {out}")


if __name__ == "__main__":
    main()
