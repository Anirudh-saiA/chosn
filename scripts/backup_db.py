r"""Daily database backup of the CHOSN Postgres (the price history cannot be re-scraped):

    python scripts/backup_db.py                 # dump, verify, report what the retention rule would delete
    python scripts/backup_db.py --prune         # the same, and delete dumps older than the rule (7 daily + 4 weekly)
    python scripts/backup_db.py --no-wait       # do not wait for the nightly import to finish (default: wait up to 4 hours)

What it does (read-only for the database: `pg_dump` takes a consistent snapshot and writes nothing to it):
  1. waits while data/daily/run.lock is held by a live process, so it never dumps in the middle of an import
  2. `docker exec chosn-postgres-1 pg_dump -Fc` streamed to <backup dir>\daily\chosn-<date>.dump.partial
     (the container's own socket login: no password is needed or printed)
  3. verifies the dump: `pg_restore --list` reads it back, and it is not under half the size of the previous dump
  4. only then renames it to chosn-<date>.dump; on a Sunday also copies it to weekly\
  5. retention: keeps the 7 newest dailies and 4 newest weeklies. Without --prune it only lists what it would delete.
     It deletes nothing else and nothing outside <backup dir>\daily and <backup dir>\weekly.
Logs: logs/backup-<date>.log; the last run's result: data/daily/backup_last_run.json. Exit code 0 only when a verified dump exists.
Settings (environment, optional): CHOSN_BACKUP_DIR (default D:\chosn-backups), CHOSN_PG_CONTAINER (chosn-postgres-1),
CHOSN_PG_DB (chosn_dev), CHOSN_PG_USER (postgres).
"""
import argparse
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
TODAY = datetime.date.today()
LOG_FILE = ROOT / "logs" / f"backup-{TODAY.isoformat()}.log"
SUMMARY = ROOT / "data" / "daily" / "backup_last_run.json"
RUN_LOCK = ROOT / "data" / "daily" / "run.lock"
LOCK = ROOT / "data" / "daily" / "backup.lock"
NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

BACKUP_DIR = pathlib.Path(os.environ.get("CHOSN_BACKUP_DIR", r"D:\chosn-backups"))
CONTAINER = os.environ.get("CHOSN_PG_CONTAINER", "chosn-postgres-1")
DB = os.environ.get("CHOSN_PG_DB", "chosn_dev")
PG_USER = os.environ.get("CHOSN_PG_USER", "postgres")
KEEP_DAILY, KEEP_WEEKLY = 7, 4
MIN_SIZE_RATIO = 0.5
WAIT_FOR_IMPORT = 4 * 3600
NAME_RE = re.compile(r"^chosn-(\d{4}-\d{2}-\d{2})\.dump$")


def log(msg):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    line = f"[{datetime.datetime.now():%H:%M:%S}] {msg}"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line, flush=True)


def write_summary(**kw):
    SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    kw["finished"] = datetime.datetime.now().isoformat(timespec="seconds")
    SUMMARY.write_text(json.dumps(kw, indent=2), encoding="utf-8")


def docker(*args, **kw):
    return subprocess.run(["docker", *args], creationflags=NO_WINDOW, **kw)


def docker_up():
    try:
        return docker("exec", CONTAINER, "pg_isready", "-U", PG_USER, "-d", DB, capture_output=True, timeout=60).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def pid_alive(pid):
    try:
        if sys.platform == "win32":
            import ctypes
            handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
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


def lock_held(path, max_age):
    """True when the lock file holds the id of a live process and is not older than max_age seconds."""
    if not path.exists() or time.time() - path.stat().st_mtime >= max_age:
        return False
    try:
        return pid_alive(int(path.read_text().strip()))
    except ValueError:
        return False


def wait_for_import():
    waited = 0
    while lock_held(RUN_LOCK, 8 * 3600):
        if waited == 0:
            log("the nightly update is running (data/daily/run.lock): waiting for it to finish")
        if waited >= WAIT_FOR_IMPORT:
            return False
        time.sleep(60)
        waited += 60
    if waited:
        log(f"the nightly update finished after {waited // 60} min of waiting")
    return True


def dumps(folder):
    """Dump files in a folder, newest first, as (date, path)."""
    found = []
    for p in folder.glob("chosn-*.dump") if folder.exists() else []:
        m = NAME_RE.match(p.name)
        if m:
            found.append((m.group(1), p))
    return sorted(found, reverse=True)


def list_dump(path):
    """Read a dump back with the container's pg_restore --list; returns the number of entries, or None if unreadable."""
    with open(path, "rb") as f:
        r = docker("exec", "-i", CONTAINER, "pg_restore", "--list", stdin=f, capture_output=True, timeout=1800)
    if r.returncode != 0:
        return None
    return sum(1 for l in r.stdout.decode("utf-8", "replace").splitlines() if l and not l.startswith(";"))


def make_dump(partial):
    started = time.time()
    with open(partial, "wb") as f:
        r = docker("exec", CONTAINER, "pg_dump", "-Fc", "-U", PG_USER, DB, stdout=f, stderr=subprocess.PIPE, timeout=3 * 3600)
    if r.returncode != 0:
        err = r.stderr.decode("utf-8", "replace").strip().splitlines()
        raise RuntimeError("pg_dump failed: " + (err[-1][:300] if err else f"exit {r.returncode}"))
    return time.time() - started


def prune(folder, keep, apply):
    old = [p for _, p in dumps(folder)[keep:]]
    for p in old:
        if apply:
            p.unlink()
            log(f"pruned {p.parent.name}\\{p.name}")
        else:
            log(f"would prune {p.parent.name}\\{p.name} (run with --prune to delete)")
    return [f"{p.parent.name}\\{p.name}" for p in old]


def mb(n):
    return round(n / 1e6, 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--prune", action="store_true", help="delete dumps beyond 7 daily + 4 weekly (default: only list them)")
    ap.add_argument("--no-wait", action="store_true", help="do not wait for the nightly update to finish")
    args = ap.parse_args()
    started = time.time()
    day = TODAY.isoformat()

    if lock_held(LOCK, 4 * 3600):
        log("another backup is already running (data/daily/backup.lock): nothing to do")
        return 0
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    LOCK.write_text(str(os.getpid()))
    partial = None
    try:
        if not docker_up():
            raise RuntimeError(f"Postgres container '{CONTAINER}' is not answering (Docker Desktop off?)")
        if lock_held(RUN_LOCK, 8 * 3600) and args.no_wait:
            raise RuntimeError("the nightly update is running and --no-wait was given")
        if not wait_for_import():
            raise RuntimeError("the nightly update still holds the lock after 4 hours; no backup taken")

        daily, weekly = BACKUP_DIR / "daily", BACKUP_DIR / "weekly"
        daily.mkdir(parents=True, exist_ok=True)
        weekly.mkdir(parents=True, exist_ok=True)
        previous = [p for d, p in dumps(daily) if d != day]
        prev_size = previous[0].stat().st_size if previous else None
        free = shutil.disk_usage(BACKUP_DIR).free
        need = (prev_size or 1_000_000_000) * 2
        if free < need:
            raise RuntimeError(f"only {free / 1e9:.1f} GB free on {BACKUP_DIR.drive}, need about {need / 1e9:.1f} GB")

        partial = daily / f"chosn-{day}.dump.partial"
        log(f"dumping {DB} from {CONTAINER} to {partial}")
        dump_secs = make_dump(partial)
        size = partial.stat().st_size
        log(f"dump written: {mb(size)} MB in {dump_secs:.0f}s")

        entries = list_dump(partial)
        if not entries:
            raise RuntimeError("the new dump cannot be read back (pg_restore --list failed); it was not kept")
        log(f"verified: pg_restore --list reads {entries} entries")
        suspect = prev_size is not None and size < prev_size * MIN_SIZE_RATIO
        if suspect:
            log(f"WARNING: the dump ({mb(size)} MB) is under half of the previous one ({mb(prev_size)} MB); kept, but look at it")

        final = daily / f"chosn-{day}.dump"
        os.replace(partial, final)
        partial = None
        weekly_copy = None
        if TODAY.weekday() == 6:  # Sunday
            weekly_copy = weekly / final.name
            shutil.copy2(final, weekly_copy)
            log(f"Sunday: copied to weekly\\{final.name}")

        pruned = prune(daily, KEEP_DAILY, args.prune) + prune(weekly, KEEP_WEEKLY, args.prune)
        write_summary(status="suspect" if suspect else "ok", dump=str(final), size_mb=mb(size), dump_seconds=round(dump_secs),
                      entries=entries, previous_size_mb=mb(prev_size) if prev_size else None, weekly_copy=str(weekly_copy) if weekly_copy else None,
                      dailies=len(dumps(daily)), weeklies=len(dumps(weekly)), prune_applied=args.prune,
                      prune_candidates=pruned, free_gb=round(shutil.disk_usage(BACKUP_DIR).free / 1e9, 1),
                      minutes=round((time.time() - started) / 60, 1))
        log(f"Done in {(time.time() - started) / 60:.1f} minutes.")
        return 0
    except Exception as e:  # noqa: BLE001
        log(f"FAILED: {e}")
        write_summary(status="failed", error=str(e)[:500])
        return 1
    finally:
        if partial is not None:
            pathlib.Path(partial).unlink(missing_ok=True)  # only our own half-written file
        LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
