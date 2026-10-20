r"""Watch Indian homegrown sneaker brands for new products:  python scripts/scan_brand_sites.py

Most of these brands run on Shopify, which publishes its catalogue at <site>/products.json. For each brand this reads the newest
products (up to 3 pages of 250), keeps the 12 newest plus anything tagged/titled pre-order or coming soon, and stores them in
brand_watch_products (migration 0045). The Releases page shows them under "Homegrown watch", with "last checked".

Polite: robots.txt and pacing come from scripts/webscraper/core.py (polite_get); a site that blocks us is skipped.
Only footwear is kept (product type / tags / title mention shoe, sneaker, slides, sandals, loafers, boots, runner, etc.).
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from webscraper.core import polite_get  # noqa: E402

BRANDS = {
    "Comet": "https://wearcomet.com",
    "Gully Labs": "https://gullylabs.com",
    "Thaely": "https://thaely.com",
    "Neeman's": "https://neemans.com",
    "Bacca Bucci": "https://baccabucci.com",
    "Campus": "https://campusactivewear.com",
    "CHNKS": "https://chnks.in",
    "Almost Gods": "https://almostgods.com",
    "Red Tape": "https://redtape.com",
}
FOOTWEAR = ("shoe", "sneaker", "slide", "sandal", "loafer", "boot", "runner", "clog", "flip", "slipper", "trainer", "footwear", "mule", "derby", "oxford")
SOON = ("pre-order", "preorder", "pre order", "coming soon", "upcoming", "launching", "waitlist", "drop")


def psql(sql):
    out = subprocess.run(["docker", "exec", "-i", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-v", "ON_ERROR_STOP=1"],
                         input=sql, capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(out.stderr[:300])


def q(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def fetch(base):
    items = []
    for page in (1, 2, 3):
        data = polite_get(f"{base}/products.json?limit=250&page={page}", as_json=True)
        batch = data.get("products", []) if isinstance(data, dict) else []
        items += batch
        if len(batch) < 250:
            break
    return items


def tag_text(p):
    tags = p.get("tags", [])
    return ",".join(tags) if isinstance(tags, list) else str(tags)


def array(p):
    tags = p.get("tags", [])
    items = tags if isinstance(tags, list) else [t.strip() for t in str(tags).split(",") if t.strip()]
    return "ARRAY[" + ",".join(q(t) for t in items[:20]) + "]::text[]"


def main():
    stmts = []
    for brand, base in BRANDS.items():
        try:
            products = fetch(base)
        except Exception as e:  # noqa: BLE001 - one brand failing must not stop the rest
            print(f"{brand}: skipped ({str(e)[:80]})")
            continue
        shoes = []
        for p in products:
            text = " ".join([str(p.get("product_type", "")), str(p.get("title", "")), tag_text(p)]).lower()
            if any(w in text for w in FOOTWEAR):
                shoes.append((p, text))
        shoes.sort(key=lambda t: t[0].get("published_at") or "", reverse=True)
        keep = shoes[:12] + [t for t in shoes[12:] if any(w in t[1] for w in SOON)][:6]
        for p, text in keep:
            variants = p.get("variants") or [{}]
            prices = [float(v["price"]) for v in variants if v.get("price")]
            available = any(v.get("available") for v in variants)
            kind = "preorder" if ("pre-order" in text or "preorder" in text or "pre order" in text) else "coming_soon" if ("coming soon" in text or "upcoming" in text) else "product"
            image = (p.get("images") or [{}])[0].get("src")
            stmts.append(
                "INSERT INTO brand_watch_products (brand, product_id, title, url, price_inr, image_url, published_at, available, tags, kind) VALUES "
                f"({q(brand)}, {q(p['id'])}, {q(p.get('title', '')[:200])}, {q(base + '/products/' + p.get('handle', ''))}, {round(min(prices)) if prices else 'NULL'}, "
                f"{q(image)}, {q(p.get('published_at'))}, {'true' if available else 'false'}, {array(p)}, {q(kind)}) "
                "ON CONFLICT (brand, product_id) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, price_inr = EXCLUDED.price_inr, image_url = EXCLUDED.image_url, "
                "available = EXCLUDED.available, kind = EXCLUDED.kind, last_seen = now();"
            )
        print(f"{brand}: {len(products)} products, {len(keep)} kept")
    if stmts:
        psql("BEGIN;\n" + "\n".join(stmts) + "\nCOMMIT;")
    print(f"[brands] {len(stmts)} products stored")


if __name__ == "__main__":
    main()
