r"""Collect the review signals CHOSN can legitimately read for each store, with where each came from.

    python scripts/trust/collect_signals.py            # writes data/trust/signals.json

Only public pages and our own data, through scripts/webscraper/core.py (robots.txt, identified User-Agent, pacing, a stop if a site
says no). What is read:

  myntra          the product ratings we already hold (retailer_product_ratings): count-weighted average over every rated shoe
  gully-labs      the aggregateRating its product pages publish (Judge.me ratings from its own customers, counts per shoe in the tens)

NOT used: Culture Circle's product-page ratings. They carry huge counts that are identical across different colours of one model (for
example 48,849 on every Yeezy 350 V2 colour), so they are the brand's pooled reviews copied onto the page, not Culture Circle customers.
  google places   store-level Google rating and rating count for each store, ONLY when GOOGLE_PLACES_API_KEY is set (the official API)

Stores with no readable review source are simply absent: nothing is guessed. Each signal carries its source and the date.
"""
import datetime
import json
import os
import re
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "webscraper"))
import core  # noqa: E402

OUT = os.path.join(ROOT, "data", "trust", "signals.json")
TODAY = datetime.date.today().isoformat()
SAMPLE = {"gully-labs": 30}


def psql(sql):
    out = subprocess.run(["docker", "exec", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-t", "-A", "-F", "|", "-c", sql],
                         capture_output=True, text=True, encoding="utf-8")
    return [line.split("|") for line in out.stdout.strip().splitlines() if line]


def aggregate(html):
    """(rating, count) from a page's schema.org Product aggregateRating, or None."""
    for block in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(block)
        except ValueError:
            continue
        for item in (d if isinstance(d, list) else [d]):
            if isinstance(item, dict) and item.get("@type") in ("Product", "ProductGroup"):
                a = item.get("aggregateRating")
                if isinstance(a, dict):
                    try:
                        return float(a["ratingValue"]), int(float(a["reviewCount"]))
                    except (KeyError, ValueError, TypeError):
                        pass
    return None


def sample_pages(store):
    if store == "culture-circle":
        cache = os.path.join(ROOT, "data", "webscraper", "cc-urls.json")
        urls = json.load(open(cache)) if os.path.exists(cache) else []
        return urls[:: max(1, len(urls) // SAMPLE[store])][: SAMPLE[store]]
    if store == "gully-labs":
        data = core.polite_get("https://gullylabs.com/products.json?limit=250&page=1", as_json=True)["products"]
        return [f"https://gullylabs.com/products/{p['handle']}" for p in data if (p.get("product_type") or "") == "Sneakers"][: SAMPLE[store]]
    return []


def from_pages(store, source_name, source_url):
    got = []
    for u in sample_pages(store):
        try:
            a = aggregate(core.polite_get(u))
        except core.SiteBlocked:
            break
        except Exception:
            continue
        if a and a[1] > 0:
            got.append(a)
    if not got:
        return None
    n = sum(c for _, c in got)
    avg = sum(r * c for r, c in got) / n
    return {"rating": round(avg, 2), "count": n, "sample": f"{len(got)} product pages", "source": source_name, "url": source_url, "date": TODAY}


def myntra():
    rows = psql("select count(*), coalesce(sum(rp.rating_count),0), round((sum(rp.rating*rp.rating_count)/nullif(sum(rp.rating_count),0))::numeric,2) "
                "from retailer_product_ratings rp join retailers r on r.id=rp.retailer_id where r.slug='myntra'")
    if rows and rows[0][2]:
        return {"rating": float(rows[0][2]), "count": int(rows[0][1]), "sample": f"{rows[0][0]} rated shoes", "source": "Myntra product ratings (read from Myntra's own pages)",
                "url": "https://www.myntra.com", "date": TODAY}
    return None


def google_places(query):
    """Store-level Google rating and count via the official Places API (New). Needs GOOGLE_PLACES_API_KEY. Outlets are combined."""
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not key:
        return None
    req = urllib.request.Request("https://places.googleapis.com/v1/places:searchText", data=json.dumps({"textQuery": query}).encode(),
                                 headers={"Content-Type": "application/json", "X-Goog-Api-Key": key,
                                          "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount"})
    try:
        places = json.load(urllib.request.urlopen(req, timeout=30)).get("places", [])
    except Exception:
        return None
    rated = [p for p in places if p.get("rating") and p.get("userRatingCount")]
    if not rated:
        return None
    n = sum(p["userRatingCount"] for p in rated)
    return {"rating": round(sum(p["rating"] * p["userRatingCount"] for p in rated) / n, 2), "count": n, "sample": f"{len(rated)} Google listings",
            "source": "Google Maps ratings (Places API)", "url": "https://developers.google.com/maps/documentation/places", "date": TODAY}


def main():
    signals = {}
    m = myntra()
    if m:
        signals["myntra"] = m
    for store, name, url in (("gully-labs", "Judge.me ratings published on Gully Labs product pages", "https://gullylabs.com"),):
        s = from_pages(store, name, url)
        if s:
            signals[store] = s
    for slug, q in (("superkicks", "Superkicks sneaker store India"), ("crepdog-crew", "Crepdog Crew sneaker store India"), ("vegnonveg", "VegNonVeg sneaker store India"),
                    ("limited-edt", "Limited Edt sneaker store India"), ("culture-circle", "Culture Circle sneakers India"), ("puma-india", "Puma India store")):
        g = google_places(q)
        if g and (slug not in signals or g["count"] > signals[slug]["count"]):
            signals[slug] = g
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(signals, open(OUT, "w", encoding="utf-8"), indent=2)
    for k, v in signals.items():
        print(f"{k}: {v['rating']} stars from {v['count']} ratings ({v['sample']}) - {v['source']}")
    if "GOOGLE_PLACES_API_KEY" not in os.environ:
        print("(no GOOGLE_PLACES_API_KEY set: Google store ratings were not collected)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
