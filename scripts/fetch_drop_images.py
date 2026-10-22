r"""Fetch a picture for each upcoming drop that has none, and keep it on our own server.

    python scripts/fetch_drop_images.py

For every drop whose shoe has no picture yet (no store lists it), the picture named by that shoe's release page (the og:image the page
publishes for sharing; the page is the one the drop already credits as its source) is downloaded, checked (a real image, under 2 MB),
and saved to data/media/releases/<style code>.<ext>. The shoe then points at it (served by the API at /media/releases/...) and the
credit line "Photo: <site>, via SoleDispatch" is saved with it. Once a store we read lists the shoe, its own picture is used instead of
this one automatically (a store picture wins in the app).

Polite: the image host's robots.txt is read first and a host that disallows us is skipped, one request per second, and the User-Agent
says who we are. The pictures belong to their publishers; this is the site owner's decision to use them.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "releases", "_soledispatch_cache.json")
OUT_DIR = os.path.join(ROOT, "data", "media", "releases")
UA = "CHOSN-price-compare/1.0 (+contact: join.sneakercommunity@gmail.com)"
MAX_BYTES = 2_000_000
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
_robots = {}


def psql(sql):
    out = subprocess.run(["docker", "exec", "-i", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-t", "-A", "-F", "|", "-c", sql],
                         capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(out.stderr[:300])
    return [line.split("|") for line in out.stdout.strip().splitlines() if line]


def robots_ok(url):
    host = urllib.parse.urlparse(url).netloc
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            txt = urllib.request.urlopen(urllib.request.Request(f"https://{host}/robots.txt", headers={"User-Agent": UA}), timeout=15).read().decode("utf-8", "ignore")
            rp.parse(txt.splitlines())
            _robots[host] = rp
        except Exception:
            _robots[host] = None
    rp = _robots[host]
    return bool(rp and rp.can_fetch(UA, url))


def credit_for(image_url, via="SoleDispatch"):
    host = urllib.parse.urlparse(image_url).netloc.replace("www.", "")
    return f"Photo: {host}" + (f", via {via}" if via else "")


def sneakerfiles_images():
    """style code -> picture, read from the images on Sneaker Files' release calendar (the alt text of each carries the style code)."""
    url = "https://www.sneakerfiles.com/release-dates/"
    if not robots_ok(url):
        return {}
    try:
        page = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read().decode("utf-8", "ignore")
    except Exception as e:
        print("Sneaker Files calendar unavailable:", type(e).__name__)
        return {}
    found = {}
    for tag in re.findall(r"<img[^>]+>", page):
        alt = re.search(r'alt="([^"]*)"', tag)
        src = re.search(r'data-srcset="([^"]+)"', tag) or re.search(r'srcset="([^"]+)"', tag)
        if not alt or not src:
            continue
        cands = [c.strip().split(" ")[0] for c in src.group(1).split(",") if c.strip().startswith("https://")]
        big = [c for c in cands if re.search(r"-(1024|768|1200)x\d+\.", c)] or cands[-1:]
        if big:
            found[alt.group(1).upper()] = big[0]
    return found


def main():
    if not os.path.exists(CACHE):
        print("no release cache yet; run scripts/scrape_release_dates.py first")
        return 0
    cache = json.load(open(CACHE, encoding="utf-8"))
    by_sku = {}
    for url, v in cache.items():
        d = v.get("data")
        if d and d.get("sku") and d.get("image"):
            by_sku[d["sku"]] = d["image"]
    rows = psql("""select distinct s.style_code from drop_events d join sneakers s on s.id = d.sneaker_id
                   where not d.is_demo and d.status = 'upcoming' and s.primary_image_url is null
                     and not exists (select 1 from sneaker_variants v join price_snapshots ps on ps.sneaker_variant_id = v.id
                                     where v.sneaker_id = s.id and ps.is_latest and ps.image_url is not null)""")
    sf = sneakerfiles_images()
    sf_by_sku = {}
    for r in rows:
        sku = r[0]
        if sku in by_sku or sku.startswith("DROP-"):
            continue
        for alt, u in sf.items():
            if sku.upper() in alt:
                sf_by_sku[sku] = u
                break
    # Shoes without a style code yet: match by name (every word of brand, model and colourway must appear in the picture's description).
    names = {r[0]: r[1] for r in psql("select s.style_code, lower(s.brand || ' ' || s.model || ' ' || s.colorway) from sneakers s where s.style_code like 'DROP-%'")}
    stop = {"x", "default", "2026", "2027", "the", "and"}
    for r in rows:
        sku = r[0]
        if not sku.startswith("DROP-") or sku not in names:
            continue
        words = [w for w in re.findall(r"[a-z0-9]+", names[sku]) if w not in stop]
        best, score = None, 0.0
        for alt, u in sf.items():
            hay = alt.lower()
            hit = sum(1 for w in words if w in hay) / max(len(words), 1)
            if hit > score:
                best, score = u, hit
        if best and score >= 0.99:
            sf_by_sku[sku] = best
    todo = [r[0] for r in rows if r[0] in by_sku or r[0] in sf_by_sku]
    print(f"{len(rows)} drops without a picture; {len([r for r in rows if r[0] in by_sku])} on their release page, {len(sf_by_sku)} on the Sneaker Files calendar")
    os.makedirs(OUT_DIR, exist_ok=True)
    saved = skipped = 0
    for sku in todo:
        via = "SoleDispatch" if sku in by_sku else ""
        url = by_sku.get(sku) or sf_by_sku[sku]
        if not re.match(r"^[A-Za-z0-9._-]{3,40}$", sku) or not url.startswith("https://"):
            skipped += 1
            continue
        if not robots_ok(url):
            skipped += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
            with urllib.request.urlopen(req, timeout=30) as res:
                ctype = res.headers.get_content_type()
                body = res.read(MAX_BYTES + 1)
        except Exception as e:
            print("skip", sku, type(e).__name__)
            skipped += 1
            continue
        if ctype not in EXT or len(body) > MAX_BYTES or len(body) < 2000:
            print("skip", sku, ctype, len(body))
            skipped += 1
            continue
        name = f"{sku}.{EXT[ctype]}"
        with open(os.path.join(OUT_DIR, name), "wb") as f:
            f.write(body)
        credit = credit_for(url, via).replace("'", "''")
        psql(f"update sneakers set primary_image_url = '/media/releases/{name}', image_credit = '{credit}' where style_code = '{sku}' and primary_image_url is null")
        saved += 1
        time.sleep(1.0)
    print(f"{saved} pictures saved to {OUT_DIR}, {skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
