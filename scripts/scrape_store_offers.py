r"""Read each store's live offers from the banner at the top of its home page.

    python scripts/scrape_store_offers.py out.json

Writes {"<retailer slug>": [{"text": "...", "url": "https://store/"}]}. Only text the store itself displays in
its top banner is kept, and only when it reads like an offer (a % or rupee amount off, free/waived shipping, a
sale). Nothing is invented: a store with no banner offer gets an empty list. Offers are site-wide, not tied to
one shoe; apparel-only offers are skipped. The daily update feeds this file to apps/api import-store-offers.
"""
import html
import json
import re
import sys
import urllib.request

STORES = {
    "superkicks": "https://www.superkicks.in/",
    "crepdog-crew": "https://crepdogcrew.com/",
    "vegnonveg": "https://www.vegnonveg.com/",
}
OFFER = re.compile(r"(\d+\s*%\s*off|flat\s*₹?\s*\d+|₹\s*\d+\s*(?:off|shipping waived)|waived|free (?:shipping|delivery)|sale (?:is )?(?:live|on)|extra \d+|cashback|use code)", re.I)
NOT_OFFER = re.compile(r"(cash on delivery|\bnow live\b|pay in|installment|streetwear|apparel|\b(?:tee|shirt|jacket|denim|watch|perfume|cap|hoodie)s?\b)", re.I)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
    except Exception:
        return ""


def banner_text(raw):
    """The store's top announcement bar: text after 'Skip to content' up to the main menu."""
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.S)
    t = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)))
    m = re.search(r"Skip to content(.{0,600}?)(?: Menu\b| Search\b| Cart\b| Account\b)", t)
    return m.group(1) if m else ""


def offers_for(base):
    text = banner_text(fetch(base))
    found = []
    for frag in re.split(r"\bShop Now\b|\bShop now\b|\*", text):
        frag = re.sub(r"[^\w₹%&.,'*+\-/ ]", " ", frag)
        frag = re.sub(r"\s+", " ", frag).strip(" -*")
        if 8 <= len(frag) <= 140 and OFFER.search(frag) and not NOT_OFFER.search(frag) and frag not in [f["text"] for f in found]:
            found.append({"text": frag, "url": base})
    return found[:3]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "store_offers.json"
    result = {slug: offers_for(url) for slug, url in STORES.items()}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    for slug, offers in result.items():
        print(f"{slug}: {len(offers)} offer(s)", *[f"- {o['text']}" for o in offers], sep="\n  " if offers else "")


if __name__ == "__main__":
    main()
