r"""Collect multi-angle product photos per sneaker from the retailers' own listing pages.

Input : a text file of `style_code|listing_url` lines (distinct, from price_snapshots.listing_url).
Output: a SQL file that sets sneakers.gallery_image_refs (and primary_image_url if empty).

Shopify stores (Superkicks, Crepdog Crew): <listing>.js lists every product image.
VegNonVeg: the product page embeds its gallery as data-lazy="...1020X1200/..." images.

Usage: python scripts/build_galleries.py listings.txt out.sql [max_images=6]
The listings file: `docker exec <postgres> psql ... -t -A -F'|' -c "select distinct s.style_code, ps.listing_url from price_snapshots ps join sneaker_variants v on v.id=ps.sneaker_variant_id join sneakers s on s.id=v.sneaker_id where ps.listing_url ~ '^https://(www\.)?(superkicks\.in|crepdogcrew\.com|vegnonveg\.com)/products/'"`.
"""
import json
import re
import sys
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "Mozilla/5.0"}
MAX_IMAGES = int(sys.argv[3]) if len(sys.argv) > 3 else 6
WORKERS = 6


def fetch(url):
    for attempt in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode("utf-8", "ignore")
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return None


def shopify_images(url):
    body = fetch(url.split("?")[0] + ".js")
    if not body:
        return []
    try:
        imgs = json.loads(body).get("images") or []
    except ValueError:
        return []
    return [("https:" + i if i.startswith("//") else i) for i in imgs]


def vnv_images(url):
    body = fetch(url)
    if not body:
        return []
    found = re.findall(r'data-lazy="(https://images\.vegnonveg\.com/resized/1020X1200/[^"]+)"', body)
    out, seen = [], set()
    for u in found:
        key = u.split("?")[0]
        if key not in seen:
            seen.add(key)
            out.append(u)
    return out


def key_of(url):
    """Same photo served at different sizes/versions counts once."""
    return re.sub(r"\?.*$", "", url).rsplit("/", 1)[-1]


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    src, out_path = sys.argv[1], sys.argv[2]
    by_code = defaultdict(list)
    for line in open(src, encoding="utf-8"):
        line = line.strip()
        if "|" in line:
            code, url = line.split("|", 1)
            by_code[code].append(url)

    def collect(item):
        code, urls = item
        gallery, seen = [], set()
        for url in urls:
            imgs = vnv_images(url) if "vegnonveg.com" in url else shopify_images(url)
            for img in imgs:
                k = key_of(img)
                if k not in seen:
                    seen.add(k)
                    gallery.append(img)
        return code, gallery

    # A handful of workers: ~7k product pages finish in minutes without hammering any one store.
    with ThreadPoolExecutor(WORKERS) as pool:
        results = list(pool.map(collect, by_code.items()))

    stmts, counts = [], []
    for code, gallery in results:
        gallery = gallery[:MAX_IMAGES]
        counts.append(len(gallery))
        if gallery:
            arr = "ARRAY[" + ",".join(sql_str(g) for g in gallery) + "]::text[]"
            stmts.append(
                f"UPDATE sneakers SET gallery_image_refs = {arr}, "
                f"primary_image_url = COALESCE(primary_image_url, {sql_str(gallery[0])}) "
                f"WHERE style_code = {sql_str(code)};"
            )
    open(out_path, "w", encoding="utf-8").write("\n".join(stmts) + "\n")
    print(f"{len(stmts)} sneakers with galleries; images per sneaker min={min(counts or [0])} max={max(counts or [0])} "
          f"multi-image={sum(1 for c in counts if c > 1)}")


if __name__ == "__main__":
    main()
