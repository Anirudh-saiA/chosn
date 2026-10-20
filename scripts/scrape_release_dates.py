r"""Gather upcoming sneaker release dates from SoleDispatch's public release calendar.

    python scripts/scrape_release_dates.py            # writes data/releases/auto_soledispatch.json (then import-drops.js reads it)

Polite and identified like every CHOSN scraper (scripts/webscraper/core.py: robots.txt, pacing, a stop if the site says no). The calendar
page lists every release; each release page states the date, retail price and style code in its description, which is what is read. Pages
are cached for 3 days (sooner when the release is within 10 days), so after the first run only a few pages are fetched each night.

Everything gathered this way is a single-source lead: the importer marks it "unconfirmed" unless the same date was already entered as
"reported" (two trackers agreed), and a date that moves is updated and flagged "unconfirmed" until it is checked again.
Dates are US release dates and prices are US dollars, as the tracker states them.
"""
import datetime
import json
import os
import re
import sys
import html as htmllib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "webscraper"))
import core  # noqa: E402

LIST_URL = "https://soledispatch.com/releases/"
CACHE = os.path.join(ROOT, "data", "releases", "_soledispatch_cache.json")
OUT = os.path.join(ROOT, "data", "releases", "auto_soledispatch.json")
HORIZON_DAYS = 150
BRAND_PAGES = ["nike", "jordan", "adidas", "new-balance", "puma", "asics", "reebok", "vans", "converse", "crocs", "salomon", "on", "saucony", "hoka"]
MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], 1)}


def split_name(name):
    q = re.search(r'["“]([^"”]+)["”]', name)
    colorway = q.group(1) if q else "Default"
    base = re.sub(r'\s*["“][^"”]*["”]', "", name).strip()
    base = re.sub(r"\s*\(.*?\)\s*", " ", base).strip()
    return re.sub(r"\s+", " ", base), colorway


def brand_model(base):
    for b in ("Nike", "adidas", "Reebok", "Vans", "New Balance", "Puma", "ASICS", "Converse", "Crocs", "On", "Salomon", "Saucony", "Hoka", "Under Armour"):
        if base.startswith(b + " "):
            return b, base[len(b) + 1:]
    if base.startswith("Air Jordan") or base.startswith("Jordan"):
        return "Jordan", base
    if " x " in base:
        return brand_model(base.split(" x ", 1)[1].strip())
    return None, base


def collab_of(base):
    parts = base.split(" x ")
    return " x ".join(parts[:-1]) if len(parts) > 1 else None


def parse_page(page):
    m = re.search(r'property="og:description" content="([^"]+)"', page)
    if not m:
        return None
    d = htmllib.unescape(m.group(1))
    date = re.search(r"release date:?\s*([A-Z][a-z]+) (\d{1,2}), (\d{4})", d)
    if not date or date.group(1) not in MONTHS:
        return None
    price = re.search(r"retail \$([\d,]+(?:\.\d+)?)", d)
    sku = re.search(r"style code ([A-Z0-9][A-Z0-9._-]{3,})", d)
    return {
        "date": f"{date.group(3)}-{MONTHS[date.group(1)]:02d}-{int(date.group(2)):02d}",
        "price": int(float(price.group(1).replace(",", ""))) if price else None,
        "sku": sku.group(1).rstrip(".,;:_-") if sku else None,
    }


def main():
    today = datetime.date.today()
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    items, seen = [], set()
    # The main calendar shows the nearest releases; each brand page lists that brand's further-out ones.
    for page_url in [LIST_URL] + [f"https://soledispatch.com/releases/{b}/" for b in BRAND_PAGES]:
        try:
            listing = core.polite_get(page_url)
        except core.SiteBlocked as e:
            print("SoleDispatch blocked us, stopping:", e)
            break
        except Exception as e:
            print("skip list", page_url, type(e).__name__)
            continue
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', listing, re.S):
            try:
                data = json.loads(block)
            except ValueError:
                continue
            if isinstance(data, dict) and data.get("@type") == "ItemList":
                for e in data["itemListElement"]:
                    if e.get("url") and e.get("name") and e["url"] not in seen:
                        seen.add(e["url"])
                        items.append((e["url"], htmllib.unescape(e["name"])))
    print(f"calendar lists {len(items)} releases")
    entries, fetched = [], 0
    for url, name in items:
        c = cache.get(url)
        stale = True
        if c and c.get("data"):
            age = (today - datetime.date.fromisoformat(c["fetched"])).days
            soon = (datetime.date.fromisoformat(c["data"]["date"]) - today).days <= 10
            stale = age >= (1 if soon else 3)
        elif c and not c.get("data"):
            stale = (today - datetime.date.fromisoformat(c["fetched"])).days >= 3
        if stale:
            try:
                data = parse_page(core.polite_get(url))
            except core.SiteBlocked as e:
                print("blocked, stopping early:", e)
                break
            except Exception as e:
                print("skip", url, type(e).__name__)
                continue
            cache[url] = {"fetched": today.isoformat(), "data": data}
            fetched += 1
        data = cache.get(url, {}).get("data")
        if not data:
            continue
        d = datetime.date.fromisoformat(data["date"])
        if d < today - datetime.timedelta(days=1) or d > today + datetime.timedelta(days=HORIZON_DAYS):
            continue
        base, colorway = split_name(name)
        brand, model = brand_model(base)
        if not brand:
            brand, model = "Nike", base
        e = {"brand": brand, "model": model, "colorway": colorway, "releaseDate": data["date"], "regions": ["us"], "currency": "USD",
             "confirmation": "unconfirmed", "auto": True, "sourceName": "SoleDispatch", "sourceUrl": url}
        if data["sku"]:
            e["styleCode"] = data["sku"].rstrip(".,;:_-")
        if data["price"]:
            e["retailPrice"] = data["price"]
        c = collab_of(base)
        if c:
            e["collab"] = c
        entries.append(e)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(cache, open(CACHE, "w", encoding="utf-8"))
    json.dump(entries, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(entries)} upcoming releases written ({fetched} pages fetched, rest from cache)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
