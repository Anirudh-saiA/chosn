r"""What kind of picture is this?  Used by fetch_news_images.py, and as a backfill:

    python scripts/image_info.py            # classify every news picture that has no style yet and store it

A sneaker "product shot" has an almost uniform light background (white or pale grey). The magazine shows those as cut-outs on a coloured
panel (the white drops away) instead of cropping them like a photograph. Anything else is a "photo" and is cropped to fill its frame.

analyze(path) returns (style, ratio): style is "product" or "photo", ratio is width / height.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS_DIR = os.path.join(ROOT, "data", "media", "news")


def analyze(path):
    from PIL import Image

    with Image.open(path) as im:
        w, h = im.size
        small = im.convert("L")
        small.thumbnail((160, 160))
    sw, sh = small.size
    px = small.load()
    ring = max(2, int(min(sw, sh) * 0.06))
    vals = [px[x, y] for y in range(sh) for x in range(sw) if x < ring or x >= sw - ring or y < ring or y >= sh - ring]
    mean = sum(vals) / len(vals)
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    style = "product" if mean >= 226 and var**0.5 <= 28 else "photo"
    return style, round(w / h, 3)


def psql(sql):
    out = subprocess.run(["docker", "exec", "-i", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-t", "-A", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql],
                         capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(out.stderr[:300])
    return [line.split("|") for line in out.stdout.strip().splitlines() if line]


def main():
    rows = psql("select id, image_url from news_items where image_url like '/media/news/%' and image_style is null")
    done = 0
    for nid, url in rows:
        path = os.path.join(NEWS_DIR, os.path.basename(url))
        if not os.path.exists(path):
            continue
        try:
            style, ratio = analyze(path)
        except Exception:  # noqa: BLE001 - an unreadable picture stays unclassified
            continue
        psql(f"update news_items set image_style = '{style}', image_ratio = {ratio} where id = '{nid}'")
        done += 1
    print(f"[image-info] {done} pictures classified")


if __name__ == "__main__":
    main()
