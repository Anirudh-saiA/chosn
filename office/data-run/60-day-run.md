# 60-day data run

Founder order, 2026-10-27. Collect 60 days of CHOSN data. Day 1 = 27 Oct 2026. Day 60 = 25 Dec 2026.

## What is collected each day
- Prices, stock, sizes, offers, ratings from every live store (the nightly scrape and the daily update).
- News and drop events (the 10-minute news cycle).
- A missing day is recorded as MISSING in LOG.md. It is never filled in, never guessed.
- 25 Oct 2026 is a permanent gap (before day 1).

## Rule: after every run, say where the data went
After each daily run, the team that ran it adds one row to office/data-run/LOG.md with: date, day number (1 to 60), status (OK / PARTIAL / MISSING), what was added (row counts), and the EXACT file or table where the data is stored (full path or table name). Main reads LOG.md each morning and tells the founder: "Day N: data stored in <file>".

## Who does what
- Nightly: runs the daily scrape, writes the LOG.md row, checks the 60-day coverage (scripts/nightly_health.py).
- Data: owns the storage. Names the files and tables, keeps them in D:\CHOSN\chosn\data and the local database, exports a daily snapshot file for each day. Reports gaps.
- Drops and News: add news and drop counts to the day's row.
- Main: reads LOG.md, reports to the founder, writes the day-60 summary.

## Storage (Data confirms or corrects this in its first report)
- Database: local Postgres chosn_dev (Docker, now on D:\CHOSN\DockerData). Table price_snapshots (fetched_at, IST day) joined to sneaker_variants, sneakers, retailers; also daily_best_prices, outlook_log, market_summaries.
- Daily snapshot file: data/daily-snapshots/<YYYY-MM-DD>.csv.gz plus <date>.manifest.json (rows, rows per store, sha256), made by scripts/export_daily_snapshot.py (on team/data until merged). About 17 MB a day, about 1 GB for 60 days.
- Run summary: data/daily/last_run_summary.json (overwritten each run; copy its key numbers into LOG.md; corrected by Data 27 Oct).
- All files stay on D:.

## End
Day 60 (25 Dec 2026): Data and Nightly each write a short report (coverage, gaps, size). Main sends the founder one page.
