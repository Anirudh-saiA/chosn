r"""News cycle, meant to run every 30 minutes, separate from the heavy nightly price update:

    python scripts/news_update.py            # one cycle
    python scripts/news_update.py --no-pictures

Steps (all from apps/api's built scripts; each is cheap, the whole cycle takes about two minutes):
  1. fetch-news-feeds      the news and culture feeds and the brand blogs
  2. fetch-official-news   SEC filings (and YouTube once YOUTUBE_API_KEY is set)
  3. fetch-email-news      newsletters and Google Alerts (skips itself until NEWS_IMAP_USER / NEWS_IMAP_PASSWORD are set)
  4. tag-news              brand and category tags, shoe and drop links, duplicate folding
  5. fetch_news_images     pictures for the newest stories (at most 15 per cycle)
  6. build-magazine        prints the next daily / weekly issue of The CHOSN Times when one is due, then render_magazine_pdf renders its PDF

A step that fails is logged and the next one still runs. A lock file stops two cycles from overlapping (a lock older than 25 minutes is
treated as stale). Logs: logs/news-YYYY-MM-DD.log; the last cycle's result: data/daily/news_last_run.json.
Needs Docker running with the CHOSN Postgres (the same as the nightly job); if it is not, the cycle is skipped and says so.
"""
import argparse
import datetime
import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
API = ROOT / "apps" / "api"
TODAY = datetime.date.today().isoformat()
LOG_FILE = ROOT / "logs" / f"news-{TODAY}.log"
LOCK = ROOT / "data" / "daily" / "news.lock"
SUMMARY = ROOT / "data" / "daily" / "news_last_run.json"
NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0  # no console window flashing up when the task runs in the background
STALE_AFTER = 25 * 60


def log(msg):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    line = f"[{datetime.datetime.now():%H:%M:%S}] {msg}"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(name, cmd, cwd, timeout=600):
    """Run one step; returns (ok, last output line)."""
    started = time.time()
    try:
        out = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=NO_WINDOW)
    except subprocess.TimeoutExpired:
        log(f"{name}: timed out after {timeout}s")
        return False, "timed out"
    lines = [l.strip() for l in (out.stdout + out.stderr).splitlines() if l.strip() and "StorageService" not in l]
    head = next((l for l in lines if l.startswith("[")), lines[-1] if lines else "") if name != "pictures" else (lines[-1] if lines else "")
    log(f"{name}: {'ok' if out.returncode == 0 else 'FAILED (exit %d)' % out.returncode} in {time.time() - started:.0f}s | {head[:200]}")
    if out.returncode != 0:
        for l in lines[-6:]:
            log("   | " + l[:300])
    return out.returncode == 0, head


def docker_up():
    try:
        return subprocess.run(["docker", "info"], capture_output=True, timeout=30, creationflags=NO_WINDOW).returncode == 0
    except Exception:  # noqa: BLE001
        return False


def take_lock():
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    if LOCK.exists() and time.time() - LOCK.stat().st_mtime < STALE_AFTER:
        return False
    LOCK.write_text(str(os.getpid()))
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-pictures", action="store_true")
    args = ap.parse_args()
    if not take_lock():
        log("another news cycle is still running: skipped")
        return 0
    started = datetime.datetime.now().isoformat(timespec="seconds")
    results = {}
    try:
        if not docker_up():
            log("Docker is not running: cycle skipped")
            results["skipped"] = "docker is not running"
            return 0
        node = ["node", "--env-file=.env"]
        for name, script in (("news feeds", "fetch-news-feeds"), ("official news", "fetch-official-news"), ("email news", "fetch-email-news"), ("tags", "tag-news")):
            ok, head = run(name, node + [f"dist/scripts/{script}.js"], API)
            results[name] = {"ok": ok, "line": head}
        if not args.no_pictures:
            ok, head = run("pictures", [sys.executable, "scripts/fetch_news_images.py", "--max", "15"], ROOT, timeout=900)
            results["pictures"] = {"ok": ok, "line": head}
        # The CHOSN Times: print the next daily / weekly issue when one is due (it does nothing otherwise), then render a PDF for any issue
        # that has none. The PDF step needs the web site running; it is skipped, and says so, when it is not.
        ok, head = run("magazine", node + ["dist/scripts/build-magazine.js"], API)
        results["magazine"] = {"ok": ok, "line": head}
        venv_py = ROOT / "tools" / "webscraper-venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
        if venv_py.exists():
            ok, head = run("magazine pdf", [str(venv_py), "scripts/render_magazine_pdf.py"], ROOT, timeout=900)
            results["magazine pdf"] = {"ok": ok, "line": head}
        return 0 if all(v["ok"] for v in results.values() if isinstance(v, dict)) else 1
    finally:
        SUMMARY.write_text(json.dumps({"started_at": started, "finished_at": datetime.datetime.now().isoformat(timespec="seconds"), "steps": results}, indent=2), encoding="utf-8")
        LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
