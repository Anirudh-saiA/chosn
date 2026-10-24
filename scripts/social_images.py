"""Picture matching for the X drafts: which post has a picture, which still needs one.

Looks in office/social/images/ (the founder's folder). A picture belongs to a post when it is named
  <yyyy-mm-dd>-morning.<ext> / <yyyy-mm-dd>-evening.<ext>   (this exact post), or
  <slug>*.<ext>                                              (library picture; slug = the shoe's fact-bank slug)
It reads nothing but file names, posts nothing, and never opens the pictures.

Usage: python scripts/social_images.py [--date YYYY-MM-DD]   (lists the picture status of that day's draft)
       python scripts/social_images.py --all                 (every draft from today on)
"""
import argparse
import datetime
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "office" / "social" / "images"
POSTS = ROOT / "office" / "social" / "posts"
EXT = {".jpg", ".jpeg", ".png", ".webp"}
RIGHTS = "Use only a picture you took or may use. Another brand's logo or someone else's photo needs a rights check."


def pictures():
    return sorted(p.name for p in IMAGES.glob("*") if p.suffix.lower() in EXT) if IMAGES.is_dir() else []


def find(day, slot, slug=""):
    """Picture file name for this post, or None. An exact dated name wins over a library picture."""
    files = pictures()
    for f in files:
        if f.lower().startswith(f"{day}-{slot}."):
            return f
    if slug:
        for f in files:
            if f.lower().startswith(slug.lower()):
                return f
    return None


def status_lines(day, posts):
    """posts: [(slot, slug, wanted)] -> markdown lines saying which picture each post has or needs."""
    out = []
    for slot, slug, wanted in posts:
        f = find(day, slot, slug)
        if f:
            out.append(f"- {slot}: `office/social/images/{f}`")
        else:
            out.append(f"- {slot}: **needs a picture**: {wanted}. Name it `{day}-{slot}.jpg` (or `{slug}-<topic>.jpg` to keep it in the library).")
    out.append(f"- Rights: {RIGHTS}")
    return out


def report(day):
    """Read a draft's '## Picture needs' block (written by social_posts.py) and check the folder."""
    p = POSTS / f"{day}.md"
    if not p.exists():
        return [f"{day}: no draft file"]
    posts = []
    for m in re.finditer(r"<!-- picture: (\w+) \| ([^|]*) \| ([^>]*?) -->", p.read_text(encoding="utf-8")):
        posts.append((m.group(1), m.group(2).strip(), m.group(3).strip()))
    if not posts:
        return [f"{day}: the draft lists no picture needs"]
    return [f"{day}"] + status_lines(day, posts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    days = [a.date]
    if a.all and POSTS.is_dir():
        today = datetime.date.today().isoformat()
        days = sorted(f.stem for f in POSTS.glob("*.md") if f.stem >= today)
    print(f"{len(pictures())} picture(s) in {IMAGES}")
    for d in days:
        print("\n".join(report(d)))


if __name__ == "__main__":
    main()
