r"""Restore test: proves the newest backup really restores, on a scratch database. Never touches the real one.

    python scripts/restore_test_db.py                       # newest dump in <backup dir>\daily
    python scripts/restore_test_db.py --dump D:\chosn-backups\weekly\chosn-2026-10-18.dump

Steps: refuse if the scratch database `chosn_restore_test` already exists (it would not be ours to drop) -> CREATE DATABASE
chosn_restore_test in the same container -> pg_restore the dump into it -> count the rows of every table in both the scratch and the
live database -> DROP DATABASE chosn_restore_test (only the one this run created, also when the restore fails).
The live database is only read (SELECT count(*)). Rows added to it since the dump (the news cycle runs every 10 minutes) show as
"live ahead", which is expected; a table that is missing, or has more rows in the restore than live, is a failure.
Result: logs/restore-test-<date>.log and data/daily/restore_test_last_run.json. Exit code 0 = restore proven.
"""
import argparse
import datetime
import json
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import backup_db as b  # noqa: E402  (shares the container/db settings, paths and docker helper)

SCRATCH = "chosn_restore_test"
LOG_FILE = b.ROOT / "logs" / f"restore-test-{b.TODAY.isoformat()}.log"
SUMMARY = b.ROOT / "data" / "daily" / "restore_test_last_run.json"


def log(msg):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    line = f"[{datetime.datetime.now():%H:%M:%S}] {msg}"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line, flush=True)


def psql(db, sql, timeout=3600):
    r = b.docker("exec", "-i", b.CONTAINER, "psql", "-U", b.PG_USER, "-d", db, "-v", "ON_ERROR_STOP=1", "-At", "-F", "|",
                 input=sql.encode(), capture_output=True, timeout=timeout)
    if r.returncode != 0:
        err = r.stderr.decode("utf-8", "replace").strip().splitlines()
        raise RuntimeError("psql failed: " + (err[-1][:300] if err else f"exit {r.returncode}"))
    return r.stdout.decode("utf-8", "replace").strip()


def table_counts(db, tables):
    sql = " union all ".join(f"select '{t}', count(*) from \"public\".\"{t}\"" for t in tables) + ";"
    return {name: int(n) for name, n in (l.split("|") for l in psql(db, sql).splitlines())}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dump", help="dump file to restore (default: the newest in the daily folder)")
    args = ap.parse_args()
    assert SCRATCH != b.DB and SCRATCH.startswith("chosn_restore_test")  # the only database this script may create or drop
    started = time.time()
    created = False
    try:
        if args.dump:
            dump = pathlib.Path(args.dump)
        else:
            found = b.dumps(b.BACKUP_DIR / "daily")
            if not found:
                raise RuntimeError(f"no dump found in {b.BACKUP_DIR / 'daily'}")
            dump = found[0][1]
        if not dump.exists():
            raise RuntimeError(f"{dump} does not exist")
        log(f"restoring {dump} ({b.mb(dump.stat().st_size)} MB) into scratch database {SCRATCH}")

        if psql("postgres", f"select 1 from pg_database where datname = '{SCRATCH}';"):
            raise RuntimeError(f"database {SCRATCH} already exists and was not created by this run; look at it and drop it by hand")
        psql("postgres", f"create database {SCRATCH};")
        created = True

        t0 = time.time()
        with open(dump, "rb") as f:
            r = b.docker("exec", "-i", b.CONTAINER, "pg_restore", "-U", b.PG_USER, "-d", SCRATCH, "--no-owner",
                         stdin=f, capture_output=True, timeout=3 * 3600)
        restore_secs = time.time() - t0
        err = r.stderr.decode("utf-8", "replace").splitlines()
        # pg_restore refreshes materialized views with an empty search_path, so a view built on a function that is called without its
        # schema name (here fx_rate_to_inr inside effective_price_inr) fails to refresh. That is the only error tolerated: the views are
        # refreshed again below with the normal search_path. Any other failed command fails the test.
        failed = [l.split("Command was:", 1)[1].strip() for l in err if "Command was:" in l]
        refresh_failed = [c for c in failed if c.startswith("REFRESH MATERIALIZED VIEW")]
        other = [c for c in failed if c not in refresh_failed]
        if other or (r.returncode != 0 and not failed):
            for l in err[:8]:
                log("   | " + l[:300])
            raise RuntimeError("pg_restore failed: " + (other[0][:200] if other else f"exit {r.returncode}"))
        log(f"pg_restore finished in {restore_secs:.0f}s; {len(refresh_failed)} materialized view refresh(es) failed inside pg_restore (known), redoing them")
        for c in refresh_failed:
            psql(SCRATCH, c.rstrip(";") + ";")
        unpopulated = psql(SCRATCH, "select count(*) from pg_matviews where not ispopulated;")
        if unpopulated != "0":
            raise RuntimeError(f"{unpopulated} materialized view(s) still empty after the refresh")

        tables = psql(b.DB, "select tablename from pg_tables where schemaname = 'public' order by 1;").splitlines()
        live = table_counts(b.DB, tables)
        restored_tables = set(psql(SCRATCH, "select tablename from pg_tables where schemaname = 'public';").splitlines())
        missing = [t for t in tables if t not in restored_tables]
        restored = table_counts(SCRATCH, [t for t in tables if t in restored_tables])

        rows, bad, ahead = [], list(missing), 0
        for t in tables:
            if t in missing:
                rows.append((t, None, live[t], "MISSING"))
                continue
            r_n, l_n = restored[t], live[t]
            verdict = "match" if r_n == l_n else ("live ahead" if l_n > r_n else "MISMATCH")
            if verdict == "MISMATCH":
                bad.append(t)
            ahead += verdict == "live ahead"
            rows.append((t, r_n, l_n, verdict))
        for t, r_n, l_n, v in rows:
            if r_n or l_n:
                log(f"  {t:<34} restored {r_n if r_n is not None else '-':>12}  live {l_n:>12}  {v}")
        matched = sum(1 for r in rows if r[3] == "match")
        log(f"{len(tables)} tables: {matched} match exactly, {ahead} with the live database ahead (new rows since the dump), {len(bad)} failed")
        status = "ok" if not bad else "failed"
        SUMMARY.parent.mkdir(parents=True, exist_ok=True)
        SUMMARY.write_text(json.dumps({
            "status": status, "dump": str(dump), "dump_mb": b.mb(dump.stat().st_size), "restore_seconds": round(restore_secs), "matview_refresh_redone": refresh_failed,
            "tables": len(tables), "match": matched, "live_ahead": ahead, "failed": bad,
            "rows": [{"table": t, "restored": r_n, "live": l_n, "result": v} for t, r_n, l_n, v in rows],
            "finished": datetime.datetime.now().isoformat(timespec="seconds"),
        }, indent=2), encoding="utf-8")
        return 0 if status == "ok" else 1
    except Exception as e:  # noqa: BLE001
        log(f"FAILED: {e}")
        SUMMARY.parent.mkdir(parents=True, exist_ok=True)
        SUMMARY.write_text(json.dumps({"status": "failed", "error": str(e)[:500]}, indent=2), encoding="utf-8")
        return 1
    finally:
        if created:
            try:
                psql("postgres", f"drop database {SCRATCH} with (force);")
                log(f"dropped scratch database {SCRATCH}")
            except Exception as e:  # noqa: BLE001
                log(f"COULD NOT DROP {SCRATCH}: {e}  (drop it by hand: docker exec {b.CONTAINER} psql -U {b.PG_USER} -c 'drop database {SCRATCH}')")


if __name__ == "__main__":
    sys.exit(main())
