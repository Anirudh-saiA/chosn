r"""Daily CHOSN update: scrape the stores, clean the data, import it, record price history.

    python scripts/daily_update.py                 # full run
    python scripts/daily_update.py --dry-run       # scrape + clean + validate, save nothing
    python scripts/daily_update.py --quick         # the fast stores only (leaves out VegNonVeg, Myntra and Puma)
    python scripts/daily_update.py --only shopify  # Superkicks + Crepdog Crew only (about 5 minutes)
    python scripts/daily_update.py --force         # import even if a store returned far fewer rows than last time

Steps (each logged to logs/daily-YYYY-MM-DD.log, files kept in data/daily/YYYY-MM-DD/):
  1. Superkicks + Crepdog Crew   scripts/scrape_shopify_prices.py   (public Shopify product data)
  2. VegNonVeg                   scripts/crawl/vegnonveg.mjs        (Crawlee, polite: <= 60 requests/minute)
  2a. Mainstreet Marketplace     scripts/scrape_mainstreet_prices.py (public collection feed; footwear only)
  2a2. Limited Edt               scripts/scrape_limitededt_prices.py (public product feed; footwear only)
  2a3. Puma India                scripts/scrape_puma_prices.py (product pages rendered in a local browser; footwear only)
  2a4. Gully Labs                scripts/scrape_gullylabs_prices.py (public product feed; sneakers only)
  2b. Myntra                     scripts/scrape_myntra_prices.py    (listing pages; about 1 request/second, so it is the slow
                                 step: allow 1-2 hours. Prices + each shoe's Myntra rating. --skip-myntra leaves it out)
  3. Pair + merge + clean        scripts/pair_products.py (same shoe across stores by brand + model + colour; listings
                                 with no style code get a code instead of being dropped), then scripts/clean_price_csv.py
  4. Safety check                a store with < 70% of last run's rows means the scrape probably broke: stop, import nothing
  5. Validate, then import       apps/api import-prices (--save --mark-missing): every price becomes a new dated
                                 snapshot (that is the price history), listings that vanished are marked out of stock,
                                 Compare summaries are recomputed.

Needs: Docker running with the CHOSN Postgres + Redis, `npm install` done, Python 3 and Node on PATH.
Exit codes: 0 ok, 2 safety check stopped the import, 1 any other failure.
"""
import argparse
import csv
import datetime
import json
import os
import pathlib
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
TODAY = datetime.date.today().isoformat()
RUN_DIR = ROOT / "data" / "daily" / TODAY
STATE = ROOT / "data" / "daily" / "last_run.json"
LOG_FILE = ROOT / "logs" / f"daily-{TODAY}.log"
COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping", "url", "in_stock",
           "image_url", "size_system", "condition", "gallery_urls"]
MIN_RATIO = 0.7
# Puma is read in a local browser (Crawl4AI), which lives in the webscraper environment.
_VENV_PY = ROOT / "tools" / "webscraper-venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
WEBSCRAPER_PY = str(_VENV_PY) if _VENV_PY.exists() else sys.executable
NPM = "npm.cmd" if sys.platform == "win32" else "npm"
NODE = "node"


SUMMARY_FILE = ROOT / "data" / "daily" / "last_run_summary.json"
_summary = {}


def write_summary(**kw):
    """Machine-readable result of the run, for the n8n workflow (and anyone else who wants to know how it went)."""
    _summary.update(kw)
    _summary["updated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
    SUMMARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_FILE.write_text(json.dumps(_summary, indent=2), encoding="utf-8")


def log(msg):
    line = f"[{datetime.datetime.now():%H:%M:%S}] {msg}"
    print(line, flush=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(name, cmd, cwd=ROOT):
    """Run a step, streaming its output into the log. Raises on a non-zero exit."""
    log(f"== {name}: {' '.join(str(c) for c in cmd)}")
    started = time.time()
    proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    tail = []
    for line in proc.stdout:  # type: ignore[union-attr]
        line = line.rstrip()
        if not line or "PriceSnapshotService" in line or "FetchHealth" in line or "StorageService" in line:
            continue  # the importer logs one line per snapshot; keep the log readable
        tail.append(line)
        tail = tail[-30:]
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write("    " + line[:400] + "\n")
    code = proc.wait()
    log(f"   {name} finished in {time.time() - started:.0f}s (exit {code})")
    if code != 0:
        for line in tail[-12:]:
            log("   | " + line[:300])
        raise RuntimeError(f"{name} failed (exit {code})")
    return tail


def read_rows(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def counts(rows):
    out = {}
    for r in rows:
        out[r["retailer"]] = out.get(r["retailer"], 0) + 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="scrape, clean and validate; save nothing")
    ap.add_argument("--only", choices=["shopify", "vegnonveg", "mainstreet", "limitededt", "gullylabs", "culturecircle", "puma", "myntra"], help="scrape just one source")
    ap.add_argument("--force", action="store_true", help="skip the safety check")
    ap.add_argument("--quick", action="store_true", help="the fast stores only: leaves out VegNonVeg, Myntra and Puma (each takes over an hour)")
    ap.add_argument("--skip-culturecircle", action="store_true", help="leave Culture Circle out")
    ap.add_argument("--skip-gullylabs", action="store_true", help="leave Gully Labs out")
    ap.add_argument("--skip-puma", action="store_true", help="leave Puma India out (about 1.5 h)")
    ap.add_argument("--skip-limitededt", action="store_true", help="leave Limited Edt out")
    ap.add_argument("--skip-mainstreet", action="store_true", help="leave Mainstreet Marketplace out")
    ap.add_argument("--skip-myntra", action="store_true", help="leave Myntra out (it is the slowest step)")
    ap.add_argument("--reuse", action="store_true", help="reuse today's already-scraped files instead of scraping again")
    args = ap.parse_args()

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    log(f"CHOSN daily update {TODAY} (dry-run={args.dry_run}, only={args.only}, force={args.force})")
    started = time.time()
    mode = "quick" if args.quick else (f"only:{args.only}" if args.only else "full")
    _summary.clear()
    write_summary(status="running", mode=mode, dry_run=args.dry_run, started_at=datetime.datetime.now().isoformat(timespec="seconds"))

    shopify_csv = RUN_DIR / "shopify.csv"
    vnv_csv = RUN_DIR / "vegnonveg.csv"
    myntra_csv = RUN_DIR / "myntra.csv"
    limitededt_csv = RUN_DIR / "limitededt.csv"
    gully_csv = RUN_DIR / "gullylabs.csv"
    puma_csv = RUN_DIR / "puma.csv"
    culture_csv = RUN_DIR / "culturecircle.csv"
    mainstreet_csv = RUN_DIR / "mainstreet.csv"
    myntra_ratings = RUN_DIR / "myntra-ratings.json"

    if not args.reuse:
        # Start from nothing: a leftover file from an earlier run today (for example a half-read store) must not be
        # imported as if it were this run's scrape.
        for f in (shopify_csv, vnv_csv, myntra_csv, limitededt_csv, gully_csv, puma_csv, culture_csv, mainstreet_csv, myntra_ratings,
                  RUN_DIR / "shopify-missing-style-code.csv", RUN_DIR / "vegnonveg-missing-style-code.csv"):
            f.unlink(missing_ok=True)

    # Every store is a different website, so they are read at the same time: the run takes as long as the slowest store
    # (Myntra, about 1.5 h) instead of the sum of all of them. Each store still paces itself politely (1.5 s between
    # requests to its own site). A store that fails is skipped; the others still update.
    # (key, label, command, working dir, slow?)
    scrapers = [
        ("shopify", "Superkicks + Crepdog Crew", [sys.executable, "scripts/scrape_shopify_prices.py", str(shopify_csv)], ROOT, False),
        # 4th arg points at a file that does not exist, so nothing is skipped as "already scraped".
        ("vegnonveg", "VegNonVeg", [NODE, "vegnonveg.mjs", "100000", str(vnv_csv), str(RUN_DIR / "none.csv")], ROOT / "scripts" / "crawl", True),
        ("mainstreet", "Mainstreet Marketplace", [sys.executable, "scripts/scrape_mainstreet_prices.py", str(mainstreet_csv)], ROOT, False),
        ("limitededt", "Limited Edt", [sys.executable, "scripts/scrape_limitededt_prices.py", str(limitededt_csv)], ROOT, False),
        ("gullylabs", "Gully Labs", [sys.executable, "scripts/scrape_gullylabs_prices.py", str(gully_csv)], ROOT, False),
        # Culture Circle has ~7,000 shoe pages (about 5 h in all): each run reads for a time budget and carries on next time.
        ("culturecircle", "Culture Circle", [sys.executable, "scripts/scrape_culturecircle_prices.py", str(culture_csv), "--minutes", "25" if args.quick else "120"], ROOT, False),
        ("puma", "Puma India", [WEBSCRAPER_PY, "scripts/scrape_puma_prices.py", str(puma_csv)], ROOT, True),
        ("myntra", "Myntra", [sys.executable, "scripts/scrape_myntra_prices.py", str(myntra_csv)], ROOT, True),
    ]
    # Which stores (as the importer names them) each scraper feeds, so a scraper that fails can be left out of the safety check.
    retailers_of = {"Superkicks + Crepdog Crew": ["Superkicks", "Crepdog Crew"], "VegNonVeg": ["VegNonVeg"],
                    "Mainstreet Marketplace": ["Mainstreet Marketplace"], "Limited Edt": ["Limited Edt"],
                    "Gully Labs": ["Gully Labs"], "Culture Circle": ["Culture Circle"], "Puma India": ["Puma India"], "Myntra": ["Myntra"]}
    failed_retailers = set()
    skipped = set()
    selected = []
    for key, label, cmd, cwd, slow in scrapers:
        if args.only is not None and key != args.only:
            continue
        if getattr(args, f"skip_{key}", False) or (args.quick and slow):
            skipped.add(label)
            continue
        selected.append((key, label, cmd, cwd))
    if skipped:
        log(f"not scraped this run: {', '.join(sorted(skipped))}")

    if not args.reuse and selected:
        def scrape(item):
            key, label, cmd, cwd = item
            t0 = time.time()
            try:
                run(label, cmd, cwd=cwd)
                return label, None, time.time() - t0
            except RuntimeError as e:  # best effort: the other stores still update
                return label, str(e), time.time() - t0

        with ThreadPoolExecutor(max_workers=len(selected)) as pool:
            results = list(pool.map(scrape, selected))
        write_summary(scrape=[{"store": n, "minutes": round(t / 60, 1), "error": err} for n, err, t in results], not_scraped=sorted(skipped))
        log("scrape timings: " + ", ".join(f"{n} {t / 60:.1f} min{' (FAILED)' if err else ''}" for n, err, t in results))
        for n, err, _ in results:
            if err:
                log(f"{n} skipped: {err}")
                failed_retailers.update(retailers_of.get(n, []))

    rows = []
    for path in (shopify_csv, vnv_csv):
        if path.exists():
            rows += [{c: r.get(c, "") for c in COLUMNS} for r in read_rows(path)]
    if not rows and not any(p.exists() for p in (myntra_csv, mainstreet_csv, limitededt_csv, puma_csv, gully_csv, culture_csv)):
        raise RuntimeError("nothing was scraped")
    merged = RUN_DIR / "merged.csv"
    with open(merged, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    log(f"merged {len(rows)} scraped rows: {counts(rows)}")

    # Pair the same shoe across stores. Listings without a style code (about 1,500 shoes) are given a code here, and
    # Crepdog-style names ("adidas Handball Spezial Night Indigo") are split into model + colour.
    paired = RUN_DIR / "paired.csv"
    pair_report = RUN_DIR / "pair_report.json"
    # Myntra publishes no style code at all, so every Myntra listing goes through the pairing step like the no-code ones.
    missing = [p for p in (RUN_DIR / "shopify-missing-style-code.csv", RUN_DIR / "vegnonveg-missing-style-code.csv", myntra_csv, mainstreet_csv, limitededt_csv, puma_csv, gully_csv, culture_csv) if p.exists()]
    run("Pair shoes", [sys.executable, "scripts/pair_products.py", str(merged), *map(str, missing), str(paired), "--report", str(pair_report)])

    clean = RUN_DIR / "clean.csv"
    run("Clean", [sys.executable, "scripts/clean_price_csv.py", str(paired), str(clean)])
    cleaned = read_rows(clean)
    today_counts = counts(cleaned)
    log(f"ready to import {len(cleaned)} rows: {today_counts}")
    write_summary(rows=today_counts)

    # Safety check against the previous successful run.
    last = json.loads(STATE.read_text()) if STATE.exists() else {}
    problems = [f"{s}: {n} rows vs {last[s]} last time" for s, n in today_counts.items() if s in last and n < MIN_RATIO * last[s]]
    # A store that was left out on purpose, or whose scraper failed or is paused (the site said no), keeps its previous data
    # untouched: it is not in the file, so nothing about it is marked out of stock. The email says it failed.
    not_updated = set(failed_retailers) | {r for lbl in skipped for r in retailers_of.get(lbl, [])}
    for s in last:
        if args.only is None and s not in today_counts and s not in not_updated:
            problems.append(f"{s}: no rows at all (had {last[s]})")
    if problems and not args.force:
        log("SAFETY CHECK STOPPED THE IMPORT (a store returned far fewer rows than last time):")
        for p in problems:
            log("   - " + p)
        log("Nothing was imported. Look at the scrape, or re-run with --force if the drop is real.")
        write_summary(status="safety_stopped", problems=problems, minutes=round((time.time() - started) / 60, 1))
        return 2

    api = ROOT / "apps" / "api"
    run("Build API", [NPM, "run", "build"], cwd=api)
    run("Validate import (nothing saved)", [NODE, "--env-file=.env", "dist/scripts/import-prices.js", str(clean)], cwd=api)
    if args.dry_run:
        log("Dry run: stopping before the save.")
        write_summary(status="ok", dry_run=True, minutes=round((time.time() - started) / 60, 1))
        return 0

    run("Merge duplicate shoes", [sys.executable, "scripts/merge_sneakers.py", str(pair_report)])
    tail = run("Import + record history", [NODE, "--env-file=.env", "dist/scripts/import-prices.js", str(clean), "--save", "--mark-missing"], cwd=api)
    for line in tail[-4:]:
        log("   " + line)

    # Each shoe's Myntra rating (best effort).
    if myntra_ratings.exists():
        try:
            run("Save Myntra ratings", [NODE, "--env-file=.env", "dist/scripts/import-product-ratings.js", str(myntra_ratings)], cwd=api)
        except RuntimeError as e:
            log(f"Myntra ratings skipped: {e}")

    # Live offers from each store's banner. Best effort: a failure here never undoes the price import.
    try:
        offers_json = RUN_DIR / "store_offers.json"
        run("Store offers", [sys.executable, "scripts/scrape_store_offers.py", str(offers_json)])
        run("Save store offers", [NODE, "--env-file=.env", "dist/scripts/import-store-offers.js", str(offers_json)], cwd=api)
    except RuntimeError as e:
        log(f"Store offers skipped: {e}")

    merged_state = {**last, **today_counts} if (args.only or skipped or failed_retailers) else today_counts
    STATE.write_text(json.dumps(merged_state, indent=2))
    log(f"Done in {(time.time() - started) / 60:.1f} minutes.")
    write_summary(status="ok", minutes=round((time.time() - started) / 60, 1))
    return 0


LOCK = ROOT / "data" / "daily" / "run.lock"
LOCK_MAX_AGE = 8 * 3600  # a lock older than this is left over from a crashed run


def _pid_alive(pid):
    try:
        import ctypes
        if sys.platform == "win32":
            handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
            if not handle:
                return False
            code = ctypes.c_ulong()
            ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
            ctypes.windll.kernel32.CloseHandle(handle)
            return code.value == 259  # STILL_ACTIVE
        os.kill(pid, 0)
        return True
    except (OSError, ValueError):
        return False


def take_lock():
    """One update at a time: the daily and the weekly task must not run together. The lock holds the running process's id,
    so a lock left behind by a killed run (the PC went to sleep, the task was stopped) is recognised as stale and ignored."""
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    if LOCK.exists() and time.time() - LOCK.stat().st_mtime < LOCK_MAX_AGE:
        try:
            if _pid_alive(int(LOCK.read_text().strip())):
                return False
        except ValueError:
            pass  # an old-format lock with no process id: treat as stale
    LOCK.write_text(str(os.getpid()))
    return True


if __name__ == "__main__":
    if not take_lock():
        log("another update is already running (data/daily/run.lock): nothing to do")
        sys.exit(0)
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        log(f"FAILED: {e}")
        write_summary(status="failed", error=str(e)[:500])
        sys.exit(1)
    finally:
        LOCK.unlink(missing_ok=True)
