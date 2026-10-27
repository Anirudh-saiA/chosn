r"""Export one day of price snapshots to data/daily-snapshots/<YYYY-MM-DD>.csv.gz (read-only on the database).

    python scripts/export_daily_snapshot.py                    # today (IST)
    python scripts/export_daily_snapshot.py --date 2026-10-27
    python scripts/export_daily_snapshot.py --date 2026-10-27 --out-dir D:\CHOSN\chosn\data\daily-snapshots

A "day" is the IST calendar day: price_snapshots rows whose fetched_at is from 00:00 to 24:00 Asia/Kolkata. Run it after the
nightly import has finished; a run during the import gives a partial file, and the manifest says so (rows per store).
Next to the file it writes <date>.manifest.json (row count, rows per store, sha256, bytes, when it was exported).
It only SELECTs (default_transaction_read_only is switched on), never changes data and prints no secrets.
Re-running a day overwrites that day's two files with the current database contents.

The file holds what the database holds, test rows included: is_fixture = 1 marks listing_url containing FIXTURE (test rows).
A day with no rows writes no data file; the manifest says rows 0 so the gap is on record, never filled in.
Prints the line to paste into office/data-run/LOG.md (date, day number, added, stored in).
"""
import argparse
import datetime
import gzip
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DAY1 = datetime.date(2026, 10, 27)  # day 1 of the 60-day run
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
PSQL = ["docker", "exec", "-e", "PGOPTIONS=-c default_transaction_read_only=on", "chosn-postgres-1",
        "psql", "-U", "postgres", "-d", "chosn_dev", "-X", "-q"]
COLUMNS = ("fetched_at_utc,style_code,brand,model,colorway,size_uk,retailer,price_inr,compare_at_price_inr,shipping_inr,"
           "in_stock,price_type,condition,is_latest,is_fixture,listing_url,snapshot_id")


def query(day):
    nxt = day + datetime.timedelta(days=1)
    return f"""COPY (
  SELECT to_char(s.fetched_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), sn.style_code, sn.brand, sn.model, sn.colorway,
         v.size, r.slug, s.price, s.compare_at_price, s.shipping_cost, s.in_stock, s.price_type, s.condition, s.is_latest,
         (s.listing_url LIKE '%FIXTURE%')::int, s.listing_url, s.id
  FROM price_snapshots s
  JOIN sneaker_variants v ON v.id = s.sneaker_variant_id
  JOIN sneakers sn ON sn.id = v.sneaker_id
  JOIN retailers r ON r.id = s.retailer_id
  WHERE s.fetched_at >= '{day} 00:00:00+05:30' AND s.fetched_at < '{nxt} 00:00:00+05:30'
  ORDER BY r.slug, sn.style_code, v.size, s.fetched_at
) TO STDOUT WITH (FORMAT csv)"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.datetime.now(IST).date().isoformat())
    ap.add_argument("--out-dir", default=str(ROOT / "data" / "daily-snapshots"))
    a = ap.parse_args()
    day = datetime.date.fromisoformat(a.date)
    out = pathlib.Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    data_file, manifest_file = out / f"{day}.csv.gz", out / f"{day}.manifest.json"
    tmp = out / f"{day}.csv.gz.part"

    p = subprocess.Popen(PSQL + ["-c", query(day)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    rows, per_store, wrote_any = 0, {}, False
    store_col = COLUMNS.split(",").index("retailer")
    import csv
    import io
    with open(tmp, "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
        head = (COLUMNS + "\n").encode()
        gz.write(head)
        reader = io.TextIOWrapper(p.stdout, encoding="utf-8", newline="")
        for line in reader:
            gz.write(line.encode("utf-8"))
            wrote_any = True
    err = p.stderr.read().decode("utf-8", "replace").strip()
    if p.wait() != 0:
        tmp.unlink(missing_ok=True)
        print(f"FAILED: psql exited {p.returncode}: {err[:300]}", file=sys.stderr)
        return 1
    if not wrote_any:
        tmp.unlink(missing_ok=True)
        data_file.unlink(missing_ok=True)
        size, digest = 0, ""
    else:
        with gzip.open(tmp, "rt", encoding="utf-8", newline="") as f:
            for rec in csv.reader(f):
                if rec and rec[0] != "fetched_at_utc":
                    per_store[rec[store_col]] = per_store.get(rec[store_col], 0) + 1
                    rows += 1
        tmp.replace(data_file)
        size = data_file.stat().st_size
        digest = hashlib.sha256(data_file.read_bytes()).hexdigest()
    manifest = {
        "date_ist": str(day), "run_day_number": (day - DAY1).days + 1, "rows": rows, "stores": len(per_store),
        "rows_per_store": dict(sorted(per_store.items())), "file": str(data_file) if rows else None,
        "bytes": size, "sha256": digest, "exported_at": datetime.datetime.now(IST).isoformat(timespec="seconds"),
        "columns": COLUMNS.split(","),
        "note": "Day is the IST calendar day of fetched_at. Test rows are included and flagged is_fixture=1." if rows else
                "MISSING: the database holds no price_snapshots rows for this day. Not filled in.",
    }
    manifest_file.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    n = manifest["run_day_number"]
    status = "OK" if rows else "MISSING"
    print(f"{day}  day {n}  {status}  {rows} rows, {len(per_store)} stores, {size} bytes -> {data_file if rows else manifest_file}")
    print(f"| {day} | {n} | {status} | {rows} snapshot rows, {len(per_store)} stores | {data_file if rows else manifest_file} "
          f"(+ table price_snapshots, fetched_at on {day} IST) | stores: {', '.join(sorted(per_store)) or 'none'} |")
    return 0 if rows else 2


if __name__ == "__main__":
    sys.exit(main())
