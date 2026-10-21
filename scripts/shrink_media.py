r"""Shrink the pictures we keep on our server, so pages and the magazine PDF stay light:

    python scripts/shrink_media.py            # data/media/news and data/media/releases
    python scripts/shrink_media.py path ...   # other folders

Each picture is scaled down to at most 1100 px on its long side and re-saved in the same format (JPEG and WebP at quality 78, PNG
optimised). A file is only replaced when the result is smaller. fetch_news_images.py calls shrink() on every new picture.
"""
import os
import sys

MAX_SIDE = 1100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def shrink(path):
    """Shrinks one picture in place. Returns (bytes before, bytes after); nothing changes when it cannot be made smaller."""
    from PIL import Image

    before = os.path.getsize(path)
    ext = path.rsplit(".", 1)[-1].lower()
    try:
        with Image.open(path) as im:
            im.load()
            if max(im.size) > MAX_SIDE:
                im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            tmp = path + ".tmp"
            if ext in ("jpg", "jpeg"):
                im.convert("RGB").save(tmp, "JPEG", quality=78, optimize=True, progressive=True)
            elif ext == "webp":
                im.save(tmp, "WEBP", quality=78)
            elif ext == "png":
                im.save(tmp, "PNG", optimize=True)
            else:
                return before, before
    except Exception:  # noqa: BLE001 - an unreadable picture is left as it is
        return before, before
    after = os.path.getsize(tmp)
    if after < before:
        os.replace(tmp, path)
        return before, after
    os.remove(tmp)
    return before, before


def main():
    folders = sys.argv[1:] or [os.path.join(ROOT, "data", "media", "news"), os.path.join(ROOT, "data", "media", "releases")]
    total_before = total_after = n = 0
    for folder in folders:
        for name in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            if name.rsplit(".", 1)[-1].lower() not in ("jpg", "jpeg", "png", "webp"):
                continue
            b, a = shrink(os.path.join(folder, name))
            total_before += b
            total_after += a
            n += 1
    print(f"[shrink] {n} pictures: {total_before // 1024} KB -> {total_after // 1024} KB")


if __name__ == "__main__":
    main()
