r"""Proposal only: which sneakers.retail_price values disagree with what real stores charge today (read-only on the database).

    python scripts/propose_retail_price_refresh.py [out.csv]      default: data/proposals/retail_price_refresh.csv

For every shoe that has a retail_price, takes the in-stock prices fetched in the last 4 days at the retail stores (marketplaces
Mainstreet and Culture Circle and test rows with FIXTURE in the listing URL are left out) and finds the most common price among
the stores. When at least 2 stores charge that price and it differs from retail_price, the shoe is listed with the current value,
the proposed value and the stores. Nothing is written to the database: Back end reviews the CSV and applies it, and a database change
needs an approved card from Main. A store price is not always the MRP (stores discount), so check a proposed value against the
brand's India page before applying; data/research/mrp_india.csv holds the ones already checked.
"""
import csv
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PSQL = ["docker", "exec", "-e", "PGOPTIONS=-c default_transaction_read_only=on", "chosn-postgres-1", "psql", "-U", "postgres",
        "-d", "chosn_dev", "-X", "-q", "-A", "-F", "|", "-t", "-c"]
SQL = """
WITH p AS (
  SELECT sn.style_code, sn.brand, sn.model, sn.retail_price, sn.updated_at::date AS row_updated, r.slug, s.price
  FROM price_snapshots s
  JOIN sneaker_variants v ON v.id = s.sneaker_variant_id
  JOIN sneakers sn ON sn.id = v.sneaker_id
  JOIN retailers r ON r.id = s.retailer_id
  WHERE s.is_latest AND s.in_stock AND s.currency = 'INR' AND s.price > 0 AND s.fetched_at > now() - interval '4 days'
    AND sn.retail_price IS NOT NULL AND r.slug NOT IN ('mainstreet-marketplace', 'culture-circle')
    AND s.listing_url NOT LIKE '%FIXTURE%'
), per_store AS (
  SELECT style_code, brand, model, retail_price, row_updated, slug, price, count(*) AS sizes FROM p GROUP BY 1,2,3,4,5,6,7
), by_price AS (
  SELECT style_code, brand, model, retail_price, row_updated, price, count(DISTINCT slug) AS n_stores,
         string_agg(DISTINCT slug, ' ' ORDER BY slug) AS stores,
         row_number() OVER (PARTITION BY style_code ORDER BY count(DISTINCT slug) DESC, sum(sizes) DESC, price DESC) AS rk
  FROM per_store GROUP BY 1,2,3,4,5,6
)
SELECT style_code, brand, model, retail_price, row_updated, price, n_stores, stores FROM by_price
WHERE rk = 1 AND n_stores >= 2 AND price <> retail_price ORDER BY brand, style_code
"""


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "proposals", "retail_price_refresh.csv")
    res = subprocess.run(PSQL + [SQL], capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        print("FAILED:", res.stderr.strip()[:300], file=sys.stderr)
        return 1
    rows = [line.split("|") for line in res.stdout.splitlines() if line.strip()]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["style_code", "brand", "model", "current_retail_price_inr", "current_row_updated", "proposed_inr", "stores_charging_it",
                    "store_slugs", "basis"])
        for r in rows:
            w.writerow(r[:6] + r[6:8] + ["most common in-stock price at >=2 retail stores, last 4 days, test rows excluded; "
                                          "not checked against the brand page"])
    print(f"{len(rows)} shoes where retail_price differs from what >=2 retail stores charge -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
