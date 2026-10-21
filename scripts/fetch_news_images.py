r"""Fetch a picture for each recent news story and keep it on our own server:  python scripts/fetch_news_images.py

For every gathered story (last 14 days) with no picture yet, the story's own page is read for the picture it publishes for sharing
(the og:image / twitter:image meta tag). The picture is downloaded, checked (a real image, between 5 KB and 2 MB), saved to
data/media/news/<story id>.<ext> and the story points at it (served by the API at /media/news/...) with a credit line
"Photo: <publisher>". The story still links to the original page.

Polite: robots.txt is read for the page and for the image host (a missing robots.txt means allowed, one that disallows us or cannot be
read means skip), one request per second, and the User-Agent says who we are. At most 60 stories per run (--max N to change).

The pictures belong to their publishers; showing them is the site owner's decision (recorded in docs/CHOSN-topics-and-tasks.txt), and each
one is credited and linked back to its story.
"""
import html
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "media", "news")
UA = "CHOSN-price-compare/1.0 (+contact: join.sneakercommunity@gmail.com)"
MAX_BYTES = 2_000_000
MIN_BYTES = 5_000
MAX_PER_RUN = 60  # python scripts/fetch_news_images.py --max N to change
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
        except urllib.error.HTTPError as e:
            _robots[host] = "open" if e.code in (404, 410) else None
        except Exception:
            _robots[host] = None
    rp = _robots[host]
    if rp == "open":
        return True
    return bool(rp and rp.can_fetch(UA, url))


def page_image(url):
    """The picture a page publishes for sharing, or None."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=30) as res:
        page = res.read(1_500_000).decode("utf-8", "ignore")
    head = page.split("</head>")[0]
    for key in ("og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"):
        for tag in re.findall(r"<meta[^>]+>", head, re.I):
            if re.search(rf'(?:property|name)=["\']{re.escape(key)}["\']', tag, re.I):
                m = re.search(r'content=["\']([^"\']+)["\']', tag, re.I)
                if m:
                    return urllib.parse.urljoin(url, html.unescape(m.group(1).strip()))
    return None


def mark_skipped(nid):
    """Remember that this story has no usable picture, so later cycles do not try it again (the credit is only shown when there is a picture)."""
    psql(f"update news_items set image_credit = 'no picture' where id = '{nid}' and image_url is null")
    return 1


def main():
    limit = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else MAX_PER_RUN
    rows = psql("""select id, source_url, source from news_items
                   where external and image_url is null and image_credit is null and source_url is not null and not is_demo
                     and published_at > now() - interval '14 days' and dup_of is null
                   order by published_at desc limit %d""" % limit)
    print(f"{len(rows)} stories without a picture")
    os.makedirs(OUT_DIR, exist_ok=True)
    saved = skipped = 0
    for nid, page, source in rows:
        try:
            if not page.startswith("https://") or not robots_ok(page):
                skipped += mark_skipped(nid)
                continue
            time.sleep(1.0)
            img = page_image(page)
            if not img or not img.startswith("https://") or not robots_ok(img):
                skipped += mark_skipped(nid)
                continue
            req = urllib.request.Request(img, headers={"User-Agent": UA, "Accept": "image/*"})
            with urllib.request.urlopen(req, timeout=30) as res:
                ctype = res.headers.get_content_type()
                body = res.read(MAX_BYTES + 1)
        except Exception as e:  # noqa: BLE001 - one story failing must not stop the rest
            print("skip", nid[:8], type(e).__name__)
            skipped += mark_skipped(nid)
            continue
        if ctype not in EXT or len(body) > MAX_BYTES or len(body) < MIN_BYTES:
            print("skip", nid[:8], ctype, len(body))
            skipped += mark_skipped(nid)
            continue
        name = f"{nid}.{EXT[ctype]}"
        with open(os.path.join(OUT_DIR, name), "wb") as f:
            f.write(body)
        try:
            from shrink_media import shrink  # keeps pages and the magazine PDF light

            shrink(os.path.join(OUT_DIR, name))
        except Exception:  # noqa: BLE001 - a picture that cannot be shrunk is used as it is
            pass
        credit = f"Photo: {source}".replace("'", "''")
        style, ratio = "photo", 1.0
        try:
            from image_info import analyze  # product shot or photograph, and its proportions

            style, ratio = analyze(os.path.join(OUT_DIR, name))
        except Exception:  # noqa: BLE001 - shown as a photograph when it cannot be analysed
            pass
        psql(f"update news_items set image_url = '/media/news/{name}', image_credit = '{credit}', image_style = '{style}', image_ratio = {ratio} where id = '{nid}' and image_url is null")
        saved += 1
        time.sleep(1.0)
    print(f"{saved} pictures saved to {OUT_DIR}, {skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
