r"""Per-shoe ratings from a store that publishes its own customers' ratings on each product page (Gully Labs, via Judge.me).
Culture Circle is deliberately NOT included: its product pages show pooled brand reviews (identical huge counts across colours).

    python scripts/trust/shoe_ratings.py [gully-labs] [--limit N]

Reads each of the store's listed product pages (public, through scripts/webscraper/core.py), takes the aggregateRating in its page data, and
writes data/trust/<store>-ratings.json in the shape import-product-ratings expects. Then:

    cd apps/api && node --env-file=.env dist/scripts/import-product-ratings.js ../../data/trust/<store>-ratings.json <store>

so a shoe's row at that store shows the rating of THAT shoe, not of the whole store.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from collect_signals import ROOT, aggregate, core, psql  # noqa: E402


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 150
    stores = [a for a in args if a in ("gully-labs",)] or ["gully-labs"]
    for slug in stores:
        urls = [r[0] for r in psql(
            "select distinct ps.listing_url from price_snapshots ps join retailers r on r.id=ps.retailer_id "
            f"where r.slug='{slug}' and ps.is_latest and ps.in_stock and ps.listing_url not like '%FIXTURE%' limit {limit}")]
        out = []
        for u in urls:
            try:
                a = aggregate(core.polite_get(u))
            except core.SiteBlocked:
                break
            except Exception:
                continue
            if a and a[1] > 0:
                out.append({"url": u, "rating": a[0], "ratingCount": a[1]})
        path = os.path.join(ROOT, "data", "trust", f"{slug}-ratings.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        json.dump(out, open(path, "w", encoding="utf-8"), indent=1)
        print(f"{slug}: {len(out)} of {len(urls)} pages publish a rating -> {path}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
