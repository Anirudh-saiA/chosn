r"""Automated "is a real business behind this store?" checks from public information.

    python scripts/trust/business_checks.py            # writes data/trust/business.json

For each store's website, read only public pages (through scripts/webscraper/core.py: robots.txt, identified User-Agent, pacing):

  domain age        when the domain was first registered (RDAP, the public registration-data protocol: https://rdap.org)
  https             the site answers over HTTPS
  gstin             an Indian GST number printed on the site that passes the official GSTIN structure and check-digit test
                    (this proves the number is well-formed, NOT that the government has it on file)
  company           a registered company or CIN number, or a registered / head-office address
  contact           a support phone number or e-mail address
  policies          links to returns/refund, privacy and terms pages

A check that is not found on the pages we can read is recorded as "not found", with the page(s) checked, so a person can look. A site that
robots.txt keeps us out of is recorded as "unreadable" and is treated as unknown, never as a failure.
"""
import datetime
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "webscraper"))
import core  # noqa: E402

OUT = os.path.join(ROOT, "data", "trust", "business.json")
TODAY = datetime.date.today()
STORES = {
    "superkicks": ("https://www.superkicks.in", "superkicks.in"),
    "crepdog-crew": ("https://crepdogcrew.com", "crepdogcrew.com"),
    "vegnonveg": ("https://www.vegnonveg.com", "vegnonveg.com"),
    "mainstreet-marketplace": ("https://marketplace.mainstreet.co.in", "mainstreet.co.in"),
    "myntra": ("https://www.myntra.com", "myntra.com"),
    "limited-edt": ("https://limitededt.in", "limitededt.in"),
    "puma-india": ("https://in.puma.com", "puma.com"),
    "gully-labs": ("https://gullylabs.com", "gullylabs.com"),
    "culture-circle": ("https://www.culture-circle.com", "culture-circle.com"),
}
# Pages where a shop usually prints who it is. Each is read only if robots.txt allows it.
EXTRA_PATHS = ["/pages/contact-us", "/pages/contact", "/pages/about-us", "/pages/about", "/contact", "/about", "/contact-us", "/aboutus", "/pages/terms-and-conditions", "/pages/terms-of-service"]
GSTIN_RE = re.compile(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b")
CIN_RE = re.compile(r"\b([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b")
PHONE_RE = re.compile(r"(?:\+91[\s-]?|0)?[6-9]\d{9}\b|\b1800[\s-]?\d{3}[\s-]?\d{3,4}\b")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
ADDRESS_RE = re.compile(r"(registered (?:office|address)|head ?office|corporate office|\bpvt\.? ?ltd\b|private limited|\bllp\b|\blimited\b)", re.I)
CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin_valid(g):
    """GSTIN structure and check digit (the published mod-36 algorithm), and a real state code (01-38 or 97/99)."""
    if not GSTIN_RE.fullmatch(g):
        return False
    if not (1 <= int(g[:2]) <= 38 or g[:2] in ("97", "99")):
        return False
    total = 0
    for i, ch in enumerate(g[:14]):
        prod = CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += prod // 36 + prod % 36
    return CHARS[(36 - total % 36) % 36] == g[14]


def rdap_age_years(domain):
    """Years since the domain was first registered, from RDAP (None when it cannot be read)."""
    try:
        req = urllib.request.Request(f"https://rdap.org/domain/{domain}", headers={"User-Agent": core.USER_AGENT, "Accept": "application/rdap+json"})
        data = json.load(urllib.request.urlopen(req, timeout=30))
    except Exception:
        return None, None
    for ev in data.get("events", []):
        if ev.get("eventAction") == "registration":
            try:
                d = datetime.date.fromisoformat(ev["eventDate"][:10])
                return round((TODAY - d).days / 365.25, 1), ev["eventDate"][:10]
            except (KeyError, ValueError):
                pass
    return None, None


def text_of(html):
    return re.sub(r"\s+", " ", re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", html, flags=re.S))


def check(slug, base, domain):
    res = {"site": base, "checked": TODAY.isoformat(), "pages": []}
    age, since = rdap_age_years(domain)
    res["domain_age_years"], res["domain_registered"] = age, since
    pages = {}
    unreadable = False
    for path in ["/"] + EXTRA_PATHS:
        url = base + path
        try:
            if not core.allowed(url):
                if path == "/":
                    unreadable = True
                continue
            html = core.polite_get(url)
        except core.SiteBlocked:
            if path == "/":
                unreadable = True
            continue
        except Exception:
            continue
        pages[url] = html
        res["pages"].append(url)
        if len(res["pages"]) >= 5:
            break
    res["https"] = base.startswith("https://") and bool(pages)
    if unreadable and not pages:
        res["unreadable"] = True
        return res
    blob = " ".join(text_of(h) for h in pages.values())
    res["text_chars"] = len(blob)
    if len(blob) < 3000:  # a page built by scripts we do not run: absence of text proves nothing
        res["unreadable"] = True
        res["reason"] = "the pages are built by scripts, so their text could not be read"
        return res
    raw = " ".join(pages.values())
    gst = sorted({g for g in GSTIN_RE.findall(blob + " " + raw)})
    res["gstin"] = {"found": gst[:3], "valid": [g for g in gst if gstin_valid(g)][:3]}
    cin = sorted(set(CIN_RE.findall(blob + " " + raw)))
    res["company"] = {"cin": cin[:2], "named_or_address": bool(ADDRESS_RE.search(blob)) or bool(cin)}
    res["contact"] = {"phone": bool(PHONE_RE.search(blob)), "email": bool(EMAIL_RE.search(blob))}
    low = raw.lower()
    res["policies"] = {
        "returns": bool(re.search(r"(refund|return)[-_ ]?polic|/policies/refund|returns?-and-exchange|/returns", low)),
        "privacy": bool(re.search(r"privacy[-_ ]?polic|/policies/privacy", low)),
        "terms": bool(re.search(r"terms[-_ ](?:of|and|&)|/policies/terms|terms-conditions|terms-and-conditions", low)),
    }
    return res


def main():
    out = {}
    for slug, (base, domain) in STORES.items():
        try:
            out[slug] = check(slug, base, domain)
        except Exception as e:  # one site must not stop the rest
            out[slug] = {"site": base, "error": f"{type(e).__name__}: {str(e)[:100]}"}
        r = out[slug]
        print(f"{slug:24} age={r.get('domain_age_years')}y https={r.get('https')} gstin={r.get('gstin', {}).get('valid')} "
              f"company={r.get('company', {}).get('named_or_address')} contact={r.get('contact')} policies={r.get('policies')}"
              + (" UNREADABLE" if r.get("unreadable") else ""), flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
