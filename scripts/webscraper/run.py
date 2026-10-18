r"""CHOSN web scraper: one command for every scraping job, with tool fallback.

    python scripts/webscraper/run.py fetch <url>            read one page with the first tool that works (prints text)
    python scripts/webscraper/run.py tools                  which tools are installed / usable / paused
    python scripts/webscraper/run.py status                 paused tools and paused sites
    python scripts/webscraper/run.py reset                  clear every pause
    python scripts/webscraper/run.py jobs                   list the jobs
    python scripts/webscraper/run.py job <name> [...]       run one job (shopify | vegnonveg | myntra | mainstreet | limitededt | puma | gullylabs)
    python scripts/webscraper/run.py all [--skip-myntra]    the whole daily update: scrape every store, pair, import, offers
                                                            (also --skip-mainstreet, --reuse, --dry-run)

Fallback: tools are tried in order http -> crawl4ai -> scrapling -> firecrawl -> browser-use. A tool that hits its own limit
(quota, credits, no key, crash) is paused for 6 hours and the next one takes over. A SITE that refuses us (403 / 429 /
challenge / login wall / robots.txt) pauses that site for 24 hours and stops: no tool is used to get past it.
"""
import os
import subprocess
import sys

# Use the toolkit's own Python (tools/webscraper-venv) when it exists, so the installed scraping tools are found.
_VENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools", "webscraper-venv", "Scripts", "python.exe")
if os.path.exists(_VENV) and os.path.abspath(sys.executable) != os.path.abspath(_VENV) and os.environ.get("CHOSN_SCRAPER_REEXEC") != "1":
    os.environ["CHOSN_SCRAPER_REEXEC"] = "1"
    sys.exit(subprocess.call([os.path.abspath(_VENV), os.path.abspath(__file__)] + sys.argv[1:]))

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import core  # noqa: E402
from engines import CHAIN  # noqa: E402

ROOT = core.ROOT
PY = sys.executable
JOBS = {
    # name: (description, command)
    "shopify": ("Superkicks + Crepdog Crew (public product lists)", [PY, "scripts/daily_update.py", "--only", "shopify", "--force"]),
    "vegnonveg": ("VegNonVeg (Crawlee)", [PY, "scripts/daily_update.py", "--only", "vegnonveg", "--force"]),
    "myntra": ("Myntra listings + ratings (slow, about 1.5 h)", [PY, "scripts/scrape_myntra_prices.py", "data/daily/myntra.csv"]),
    "mainstreet": ("Mainstreet Marketplace sneakers", [PY, "scripts/scrape_mainstreet_prices.py"]),
    "gullylabs": ("Gully Labs sneakers (public product feed)", [PY, "scripts/scrape_gullylabs_prices.py"]),
    "puma": ("Puma India footwear (rendered pages, about 1.5 h)", [PY, "scripts/scrape_puma_prices.py"]),
    "limitededt": ("Limited Edt footwear (public product feed)", [PY, "scripts/scrape_limitededt_prices.py"]),
}


def fetch(url):
    if core.domain_blocked(core.domain_of(url)):
        print(f"SITE PAUSED: {core.status()['paused_domains'].get(core.domain_of(url))}")
        return 2
    if not core.allowed(url):
        print(f"robots.txt disallows {url}: not fetched.")
        return 2
    tried = []
    for eng in CHAIN:
        ok, why = eng.available()
        if not ok:
            tried.append(f"{eng.name}: skipped ({why})")
            continue
        if core.tool_paused(eng.name):
            tried.append(f"{eng.name}: paused")
            continue
        try:
            page = eng.fetch(url)
        except core.NeedsRendering as e:
            tried.append(f"{eng.name}: {e}; trying a rendering tool")
            continue
        except core.LimitReached as e:
            core.pause_tool(eng.name, str(e))
            tried.append(f"{eng.name}: LIMIT ({e}); switched it off, next tool")
            continue
        except core.SiteBlocked as e:
            core.block_domain(core.domain_of(url), str(e))
            print(f"SITE BLOCKED ({e}). Stopped: not trying other tools to get past it.")
            for t in tried:
                print("  -", t)
            return 3
        print(f"[fetched with {page.engine}] {len(page.text)} characters")
        print(page.text[:1500])
        return 0
    print("No tool could fetch the page:")
    for t in tried:
        print("  -", t)
    return 1


def tools():
    st = core.status()
    for eng in CHAIN:
        ok, why = eng.available()
        paused = st["paused_tools"].get(eng.name)
        state = "PAUSED (" + paused["reason"][:70] + ")" if paused else ("ready" if ok else "not usable: " + why)
        print(f"{eng.name:12s} {state}")


def run_job(name, extra):
    desc, cmd = JOBS[name]
    print(f"== {name}: {desc}")
    return subprocess.call(cmd + extra, cwd=ROOT, env={**os.environ, "PYTHONIOENCODING": "utf-8"})


def main(argv):
    if not argv:
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == "fetch" and rest:
        return fetch(rest[0])
    if cmd == "tools":
        return tools() or 0
    if cmd == "status":
        print(core.status())
        return 0
    if cmd == "reset":
        core.reset_state()
        print("all pauses cleared")
        return 0
    if cmd == "jobs":
        for n, (d, _) in JOBS.items():
            print(f"{n:12s} {d}")
        return 0
    if cmd == "job" and rest and rest[0] in JOBS:
        return run_job(rest[0], rest[1:])
    if cmd == "all":
        return subprocess.call([PY, "scripts/daily_update.py"] + rest, cwd=ROOT, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
