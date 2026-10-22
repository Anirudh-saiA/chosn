r"""Morning health report for the CHOSN scheduled jobs (read-only).

    python scripts/nightly_health.py                 # report for today -> office/nightly/health/<date>.md
    python scripts/nightly_health.py --date 2026-10-22
    python scripts/nightly_health.py --stdout        # print instead of writing the file

Reads: logs/daily-<date>.log, logs/news-<date>.log, data/daily/last_run_summary.json, data/daily/news_last_run.json,
the Windows scheduled tasks, Docker and the CHOSN Postgres (SELECT only, through `docker exec ... psql`), and disk sizes.
Writes only the report file. It never changes data, never runs a job and prints no secrets.

Run it from the main checkout, where logs/ and data/daily/ live, for example by the 08:00 morning routine. From another
checkout, pass --data-root <main checkout>; the report is still written under this checkout's office/.
"""
import argparse
import datetime
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]  # where the report is written
DATA = ROOT  # where logs/ and data/ are read from (--data-root)
PG = ["docker", "exec", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-At", "-F", "|", "-c"]
TASKS = {"daily": "CHOSN webscraper daily update", "weekly": "CHOSN webscraper weekly full", "news": "CHOSN news cycle"}
DISK_RED_GB = 10
PRICE_STALE_H = 26
NEWS_STALE_MIN = 45

red, amber, ok = [], [], []


def sh(cmd, timeout=40):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
        return p.returncode, p.stdout.strip()
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, str(e)


def sql(query):
    code, out = sh(PG + [query])
    return [line.split("|") for line in out.splitlines() if line] if code == 0 else None


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def parse_ts(s):
    try:
        return datetime.datetime.fromisoformat(s.strip().replace(" ", "T")[:19])
    except (ValueError, AttributeError):
        return None


def ago(ts, now):
    if ts is None:
        return "unknown"
    mins = (now - ts).total_seconds() / 60
    if mins < 90:
        return f"{mins:.0f} min ago"
    if mins < 48 * 60:
        return f"{mins / 60:.1f} h ago"
    return f"{mins / 1440:.1f} days ago"


def dir_size(path):
    total = 0
    for p in path.rglob("*"):
        try:
            if p.is_file():
                total += p.stat().st_size
        except OSError:
            pass
    return total


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def task_info():
    names = ",".join(f"'{v}'" for v in TASKS.values())
    ps = ("$r=foreach($n in @(" + names + ")){$i=Get-ScheduledTaskInfo -TaskName $n -ErrorAction SilentlyContinue;"
          "if($i){[pscustomobject]@{Name=$n;Last=$i.LastRunTime.ToString('s');Result=$i.LastTaskResult;Next=$i.NextRunTime.ToString('s')}}};"
          "$r|ConvertTo-Json -Compress")
    code, out = sh(["powershell", "-NoProfile", "-Command", ps])
    if code != 0 or not out:
        return None
    data = json.loads(out)
    return data if isinstance(data, list) else [data]


def daily_section(date, now, summary):
    log_path = DATA / "logs" / f"daily-{date}.log"
    lines = ["## Nightly price job (02:00 daily, quick mode)"]
    if not log_path.exists():
        due = datetime.datetime.combine(datetime.date.fromisoformat(date), datetime.time(2, 30))
        if now > due:
            red.append(f"The nightly job did not run on {date}: there is no logs/daily-{date}.log. Catch it up with scripts\\run-daily.cmd.")
        lines.append(f"- No log for {date}.")
        return lines
    text = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    first = next((l for l in text if "CHOSN daily update" in l), "")
    start = re.match(r"\[(\d\d:\d\d:\d\d)\]", first)
    done = next((l for l in reversed(text) if re.search(r"Done in [\d.]+ minutes", l)), None)
    failed = next((l for l in reversed(text) if "FAILED:" in l or "SAFETY CHECK STOPPED" in l or "nothing to do" in l), None)
    status = (summary or {}).get("status", "unknown") if (summary or {}).get("started_at", "")[:10] == date else "unknown"
    lines.append(f"- Started {start.group(1) if start else '?'} · summary status **{status}** · mode {(summary or {}).get('mode', '?')}")
    if done:
        lines.append(f"- {done.split('] ', 1)[-1]}")
        ok.append("Nightly job finished.")
    elif status == "running":
        started = parse_ts((summary or {}).get("started_at"))
        lines.append(f"- Still running (started {ago(started, now)}).")
        if started and (now - started).total_seconds() > 5 * 3600:
            red.append("The nightly job has been running for more than 5 hours: it is stuck.")
    if failed and not done:
        red.append(f"Nightly job stopped: {failed.split('] ', 1)[-1][:200]}")
    if status == "safety_stopped":
        red.append("Safety check stopped the import (a store returned far fewer rows). Nothing was imported. See the log.")
    # per-store results
    scrape = (summary or {}).get("scrape") or []
    rows = (summary or {}).get("rows") or {}
    if scrape:
        lines += ["", "| Store | Minutes | Result |", "|---|---|---|"]
        for s in scrape:
            res = "ok" if not s.get("error") else "FAILED: " + s["error"][:120]
            if s.get("error"):
                red.append(f"Scraper failed: {s['store']} - {s['error'][:150]} (owner: Data).")
            lines.append(f"| {s['store']} | {s['minutes']} | {res} |")
    if rows:
        lines += ["", "Rows ready to import: " + ", ".join(f"{k} {v}" for k, v in sorted(rows.items(), key=lambda kv: -kv[1]))]
    ns = (summary or {}).get("not_scraped")
    if ns:
        lines.append("Not scraped this run on purpose: " + ", ".join(ns))
    # best-effort steps that were skipped
    skipped = [l.split("] ", 1)[-1] for l in text if re.match(r"\[[\d:]+\] .+ skipped: ", l) and "Myntra ratings" not in l]
    for s in skipped:
        amber.append("Best-effort step skipped: " + s[:200])
    if skipped:
        lines += ["", "Steps that were skipped (the import still happened): "] + [f"- {s[:200]}" for s in skipped]
    blocked = [l.split("] ", 1)[-1] for l in text if re.search(r"blocked|paused for 24|robots", l, re.I)]
    if blocked:
        amber.append("A store may have blocked or paused: " + blocked[0][:200])
        lines += ["", "Block or pause notices: "] + [f"- {b[:200]}" for b in blocked[:5]]
    return lines


def news_section(now):
    lines = ["## News cycle (every 10 minutes)"]
    n = read_json(DATA / "data" / "daily" / "news_last_run.json")
    if not n:
        red.append("No news run summary (data/daily/news_last_run.json).")
        return lines + ["- No summary found."]
    fin = parse_ts(n.get("finished_at"))
    lines.append(f"- Last run finished {fin:%Y-%m-%d %H:%M} ({ago(fin, now)})")
    if fin and (now - fin).total_seconds() > NEWS_STALE_MIN * 60:
        red.append(f"The news cycle has not finished a run for {ago(fin, now).replace(' ago', '')} (should be every 10 minutes).")
    for name, step in (n.get("steps") or {}).items():
        mark = "ok" if step.get("ok") else "FAILED"
        if not step.get("ok"):
            red.append(f"News step failed: {name} - {step.get('line', '')[:150]} (owner: Drops and News).")
        lines.append(f"- {name}: {mark} - {step.get('line', '')}")
        if re.search(r"\bskipped: set \w+", step.get("line", "")):
            amber.append(f"News step '{name}' is switched off: {step['line'][:150]}")
    return lines


def freshness_section(now):
    lines = ["## Data freshness"]
    q = {
        "newest price": "select max(fetched_at) from price_snapshots",
        "prices fetched in last 24 h": "select count(*) from price_snapshots where fetched_at > now() - interval '24 hours'",
        "newest news story": "select max(created_at) from news_items where coalesce(is_demo,false)=false",
        "newest drop update": "select max(updated_at) from drop_events where coalesce(is_demo,false)=false",
        "newest magazine issue": "select max(published_at) from magazine_issues",
        "exchange rates updated": "select max(updated_at) from fx_rates",
        "database size": "select pg_size_pretty(pg_database_size('chosn_dev'))",
    }
    vals = {}
    for label, query in q.items():
        r = sql(query)
        vals[label] = r[0][0] if r and r[0] and r[0][0] else None
    for label, v in vals.items():
        if label in ("database size", "prices fetched in last 24 h"):
            lines.append(f"- {label}: {v if v is not None else 'unknown'}")
        else:
            ts = parse_ts(v) if v else None
            lines.append(f"- {label}: {v[:16] if v else 'none'} ({ago(ts, now)})")
    p = parse_ts(vals["newest price"]) if vals["newest price"] else None
    if vals["newest price"] is None and vals["database size"] is None:
        red.append("The database could not be read (Docker or Postgres down?).")
    elif p is None or (now - p).total_seconds() > PRICE_STALE_H * 3600:
        red.append(f"Prices are stale: newest price is {ago(p, now)}.")
    return lines


def system_section():
    lines = ["## System"]
    code, out = sh(["docker", "ps", "--format", "{{.Names}} {{.Status}}"])
    if code != 0:
        red.append("Docker is not running.")
        lines.append("- Docker: not running")
    else:
        names = out.splitlines()
        lines.append("- Docker: " + ("; ".join(names) if names else "no containers"))
        for want in ("chosn-postgres-1", "chosn-redis-1"):
            if not any(l.startswith(want) for l in names):
                red.append(f"Container {want} is not running.")
    total, used, free = shutil.disk_usage(DATA)
    lines.append(f"- Disk {DATA.drive or '/'}: {human(free)} free of {human(total)}")
    if free < DISK_RED_GB * 1024 ** 3:
        red.append(f"Disk is nearly full: {human(free)} free.")
    elif free < 2 * DISK_RED_GB * 1024 ** 3:
        amber.append(f"Disk is getting full: {human(free)} free (a nightly folder is about 0.5 GB, the database about 3 GB).")
    for rel in ("data/media", "data/daily", "logs"):
        p = DATA / rel
        lines.append(f"- {rel}: {human(dir_size(p)) if p.exists() else 'missing'}")
    info = task_info()
    if info:
        lines += ["", "Scheduled tasks:", "", "| Task | Last run | Result | Next run |", "|---|---|---|---|"]
        for t in info:
            res = t["Result"]
            meaning = {0: "ok", 267009: "running", 267011: "never run", 267014: "stopped by time limit", 1: "FAILED (exit 1)"}.get(res, f"code {res}")
            lines.append(f"| {t['Name']} | {t['Last'].replace('T', ' ')[:16]} | {meaning} | {t['Next'].replace('T', ' ')[:16]} |")
            if res not in (0, 267009, 267011):
                amber.append(f"Task '{t['Name']}' last result was {meaning}.")
    else:
        amber.append("Could not read the Windows scheduled tasks.")
        lines.append("- Scheduled tasks: could not be read")
    backups = DATA.parent / "chosn-backups"
    lines.append("- Database backups: " + (f"{len(list(backups.glob('*.dump')))} dump files in {backups}" if backups.exists() else "none yet (no backup job built; plan awaiting approval)"))
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--stdout", action="store_true")
    ap.add_argument("--data-root", help="checkout whose logs/ and data/ to read (default: this one)")
    args = ap.parse_args()
    global DATA
    if args.data_root:
        DATA = pathlib.Path(args.data_root).resolve()
    now = datetime.datetime.now()
    summary = read_json(DATA / "data" / "daily" / "last_run_summary.json")

    body = daily_section(args.date, now, summary) + [""] + news_section(now) + [""] + freshness_section(now) + [""] + system_section()
    head = [f"# Nightly health report {args.date}", f"Generated {now:%Y-%m-%d %H:%M} by scripts/nightly_health.py (read-only).", ""]
    if red:
        head += ["## RED (needs action)"] + [f"- {r}" for r in red] + [""]
    else:
        head += ["## RED", "- Nothing red.", ""]
    if amber:
        head += ["## Amber (watch)"] + [f"- {a}" for a in amber] + [""]
    head += ["## The one thing to know", f"- {red[0] if red else (amber[0] if amber else 'Everything ran and is fresh.')}", ""]
    out = "\n".join(head + body) + "\n"
    if args.stdout:
        sys.stdout.buffer.write(out.encode("utf-8"))
        return
    path = ROOT / "office" / "nightly" / "health" / f"{args.date}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(out, encoding="utf-8")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
