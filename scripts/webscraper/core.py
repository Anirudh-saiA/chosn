r"""Shared rules for every CHOSN scraper. One place decides what is allowed, so no tool can quietly skip them.

  - robots.txt is read for every domain; a disallowed path is never fetched.
  - Requests identify themselves (User-Agent) and wait between hits to the same domain (default 1.5 s; the longer of that
    and the site's Crawl-delay).
  - A site that says no (HTTP 403 / 429, a CAPTCHA or bot challenge, a login or "free views expired" wall) is SiteBlocked:
    the domain is paused for 24 h and the scrape of that site stops. It is NOT retried with another tool: switching
    tools to get past a block is what this module exists to prevent.
  - A TOOL that runs out of its own allowance (an API quota, credits, a missing key, a crash) is LimitReached: that
    tool is switched off for the run and the next one in the chain is used. That is the fallback.
State (paused tools and domains) lives in data/webscraper/state.json.
"""
import json
import pathlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

ROOT = pathlib.Path(__file__).resolve().parents[2]
STATE_FILE = ROOT / "data" / "webscraper" / "state.json"
USER_AGENT = "CHOSN-price-compare/1.0 (+sneaker price comparison; contact join.sneakercommunity@gmail.com)"
MIN_DELAY = 1.5
BLOCK_PAUSE_HOURS = 24
TOOL_PAUSE_HOURS = 6


class SiteBlocked(Exception):
    """The site refused (or asked for a login / challenge). Stop scraping it; do not try another tool."""


class LimitReached(Exception):
    """A scraping TOOL hit its own limit (quota, credits, missing key, crash). Use the next tool."""


class NeedsRendering(Exception):
    """The page came back empty because it needs JavaScript. A browser-based tool may fetch it (that is not evasion)."""


def _load():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"tools": {}, "domains": {}}


def _save(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _active(until):
    return until and time.time() < until


def tool_paused(name):
    return _active(_load()["tools"].get(name, {}).get("until"))


def pause_tool(name, reason, hours=TOOL_PAUSE_HOURS):
    s = _load()
    s["tools"][name] = {"until": time.time() + hours * 3600, "reason": reason[:300], "at": time.strftime("%Y-%m-%d %H:%M")}
    _save(s)


def domain_blocked(domain):
    return _active(_load()["domains"].get(domain, {}).get("until"))


def block_domain(domain, reason, hours=BLOCK_PAUSE_HOURS):
    s = _load()
    s["domains"][domain] = {"until": time.time() + hours * 3600, "reason": reason[:300], "at": time.strftime("%Y-%m-%d %H:%M")}
    _save(s)


def reset_state():
    _save({"tools": {}, "domains": {}})


def status():
    s = _load()
    now = time.time()
    return {
        "paused_tools": {k: v for k, v in s["tools"].items() if v.get("until", 0) > now},
        "paused_domains": {k: v for k, v in s["domains"].items() if v.get("until", 0) > now},
    }


# ---------------------------------------------------------------- robots + pacing
_robots = {}
_last_hit = {}


def domain_of(url):
    return urllib.parse.urlparse(url).netloc.lower()


def robots_for(url):
    p = urllib.parse.urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": USER_AGENT})
            rp.parse(urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore").splitlines())
        except Exception:
            rp.parse([])  # no robots.txt (or unreadable): nothing is disallowed
        _robots[base] = rp
    return _robots[base]


def allowed(url):
    return robots_for(url).can_fetch(USER_AGENT, url) or robots_for(url).can_fetch("*", url)


# Sites that answered HTTP 429 at the default pace get a longer pause between requests (seen 18 Oct 2026, after full
# product-feed reads of 100+ large pages). The 429 handling still stops a site that keeps saying no.
DOMAIN_DELAY = {"marketplace.mainstreet.co.in": 4.0, "www.superkicks.in": 3.0, "www.culture-circle.com": 2.0}


def pace(url):
    dom = domain_of(url)
    delay = max(MIN_DELAY, DOMAIN_DELAY.get(dom, 0), float(robots_for(url).crawl_delay(USER_AGENT) or robots_for(url).crawl_delay("*") or 0))
    wait = _last_hit.get(dom, 0) + delay - time.time()
    if wait > 0:
        time.sleep(wait)
    _last_hit[dom] = time.time()


# ---------------------------------------------------------------- block detection
BLOCK_MARKERS = re.compile(
    r"(captcha|are you a robot|verify you are human|access denied|request blocked|unusual traffic|attention required|"
    r"perimeterx|px-captcha|cf-chl|just a moment\.\.\.|free views have expired|sign (up|in) to (continue|view))",
    re.I,
)
JS_MARKERS = re.compile(r"(enable javascript|you need to enable javascript|<noscript>[^<]*javascript)", re.I)


def check_page(url, status_code, body):
    """Raise SiteBlocked / NeedsRendering when the response says so. Returns None for a normal page."""
    if status_code in (401, 403, 429):
        raise SiteBlocked(f"HTTP {status_code} from {domain_of(url)}")
    if BLOCK_MARKERS.search(body[:6000]) and len(body) < 60000:
        raise SiteBlocked(f"bot challenge or login wall on {domain_of(url)}")
    text = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", body, flags=re.S)
    if len(text.strip()) < 300 or JS_MARKERS.search(body[:6000]):
        raise NeedsRendering(f"{domain_of(url)} returned almost no text without JavaScript")


def polite_get(url, as_json=False, retries=2):
    """Plain HTTP GET that follows every rule above. For APIs and pages that need no rendering."""
    if domain_blocked(domain_of(url)):
        raise SiteBlocked(f"{domain_of(url)} is paused: {_load()['domains'][domain_of(url)]['reason']}")
    if not allowed(url):
        raise SiteBlocked(f"robots.txt disallows {url}")
    for attempt in range(retries + 1):
        pace(url)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.8"})
        try:
            raw = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
            return json.loads(raw) if as_json else raw
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:  # slow down and honour Retry-After; only stop if it keeps saying no
                time.sleep(min(int(e.headers.get("Retry-After") or 30), 120))
                continue
            if e.code in (401, 403, 429):
                block_domain(domain_of(url), f"HTTP {e.code}")
                raise SiteBlocked(f"HTTP {e.code} from {domain_of(url)}")
            if e.code >= 500 and attempt < retries:
                time.sleep(3 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError, OSError):  # includes connection resets
            if attempt < retries:
                time.sleep(3 * (attempt + 1))
                continue
            raise
