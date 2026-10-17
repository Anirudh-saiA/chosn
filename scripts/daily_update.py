r"""Daily CHOSN update: scrape the stores, clean the data, import it, record price history.

    python scripts/daily_update.py                 # full run
    python scripts/daily_update.py --dry-run       # scrape + clean + validate, save nothing
    python scripts/daily_update.py --only shopify  # Superkicks + Crepdog Crew only (about 5 minutes)
    python scripts/daily_update.py --force         # import even if a store returned far fewer rows than last time

Steps (each logged to logs/daily-YYYY-MM-DD.log, files kept in data/daily/YYYY-MM-DD/):
  1. Superkicks + Crepdog Crew   scripts/scrape_shopify_prices.py   (public Shopify product data)
  2. VegNonVeg                   scripts/crawl/vegnonveg.mjs        (Crawlee, polite: <= 60 requests/minute)
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
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
TODAY = datetime.date.today().isoformat()
RUN_DIR = ROOT / "data" / "daily" / TODAY
STATE = ROOT / "data" / "daily" / "last_run.json"
LOG_FILE = ROOT / "logs" / f"daily-{TODAY}.log"
COLUMNS = ["brand", "model", "colorway", "style_code", "size", "retailer", "price", "shipping", "url", "in_stock",
           "image_url", "size_system", "condition"]
MIN_RATIO = 0.7
NPM = "npm.cmd" if sys.platform == "win32" else "npm"
NODE = "node"


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
    ap.add_argument("--only", choices=["shopify", "vegnonveg"], help="scrape just one source")
    ap.add_argument("--force", action="store_true", help="skip the safety check")
    ap.add_argument("--reuse", action="store_true", help="reuse today's already-scraped files instead of scraping again")
    args = ap.parse_args()

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    log(f"CHOSN daily update {TODAY} (dry-run={args.dry_run}, only={args.only}, force={args.force})")
    started = time.time()

    shopify_csv = RUN_DIR / "shopify.csv"
    vnv_csv = RUN_DIR / "vegnonveg.csv"
    if not args.reuse:
        if args.only in (None, "shopify"):
            run("Superkicks + Crepdog Crew", [sys.executable, "scripts/scrape_shopify_prices.py", str(shopify_csv)])
        if args.only in (None, "vegnonveg"):
            # 4th arg points at a file that does not exist, so nothing is skipped as "already scraped".
            run("VegNonVeg", [NODE, "vegnonveg.mjs", "100000", str(vnv_csv), str(RUN_DIR / "none.csv")], cwd=ROOT / "scripts" / "crawl")

    rows = []
    for path in (shopify_csv, vnv_csv):
        if path.exists():
            rows += [{c: r.get(c, "") for c in COLUMNS} for r in read_rows(path)]
    if not rows:
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
    missing = [p for p in (RUN_DIR / "shopify-missing-style-code.csv", RUN_DIR / "vegnonveg-missing-style-code.csv") if p.exists()]
    run("Pair shoes", [sys.executable, "scripts/pair_products.py", str(merged), *map(str, missing), str(paired), "--report", str(pair_report)])

    clean = RUN_DIR / "clean.csv"
    run("Clean", [sys.executable, "scripts/clean_price_csv.py", str(paired), str(clean)])
    cleaned = read_rows(clean)
    today_counts = counts(cleaned)
    log(f"ready to import {len(cleaned)} rows: {today_counts}")

    # Safety check against the previous successful run.
    last = json.loads(STATE.read_text()) if STATE.exists() else {}
    problems = [f"{s}: {n} rows vs {last[s]} last time" for s, n in today_counts.items() if s in last and n < MIN_RATIO * last[s]]
    for s in last:
        if args.only is None and s not in today_counts:
            problems.append(f"{s}: no rows at all (had {last[s]})")
    if problems and not args.force:
        log("SAFETY CHECK STOPPED THE IMPORT (a store returned far fewer rows than last time):")
        for p in problems:
            log("   - " + p)
        log("Nothing was imported. Look at the scrape, or re-run with --force if the drop is real.")
        return 2

    api = ROOT / "apps" / "api"
    run("Build API", [NPM, "run", "build"], cwd=api)
    run("Validate import (nothing saved)", [NODE, "--env-file=.env", "dist/scripts/import-prices.js", str(clean)], cwd=api)
    if args.dry_run:
        log("Dry run: stopping before the save.")
        return 0

    run("Merge duplicate shoes", [sys.executable, "scripts/merge_sneakers.py", str(pair_report)])
    tail = run("Import + record history", [NODE, "--env-file=.env", "dist/scripts/import-prices.js", str(clean), "--save", "--mark-missing"], cwd=api)
    for line in tail[-4:]:
        log("   " + line)

    # Live offers from each store's banner. Best effort: a failure here never undoes the price import.
    try:
        offers_json = RUN_DIR / "store_offers.json"
        run("Store offers", [sys.executable, "scripts/scrape_store_offers.py", str(offers_json)])
        run("Save store offers", [NODE, "--env-file=.env", "dist/scripts/import-store-offers.js", str(offers_json)], cwd=api)
    except RuntimeError as e:
        log(f"Store offers skipped: {e}")

    merged_state = {**last, **today_counts} if args.only else today_counts
    STATE.write_text(json.dumps(merged_state, indent=2))
    log(f"Done in {(time.time() - started) / 60:.1f} minutes.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        log(f"FAILED: {e}")
        sys.exit(1)
