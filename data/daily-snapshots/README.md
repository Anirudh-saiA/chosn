# data/daily-snapshots: one price file per day for the 60-day run

Day 1 = 2026-10-27, day 60 = 2026-12-25. Written by `scripts/export_daily_snapshot.py` (read-only on the database) after the nightly import. Lives in the main checkout, `D:\CHOSN\chosn\data\daily-snapshots\` (git-ignored; all on D:).

| File | What |
|---|---|
| `<YYYY-MM-DD>.csv.gz` | every `price_snapshots` row whose `fetched_at` falls on that IST day, with style code, brand, model, colourway, UK size, store, price, compare-at price, stock, price type, condition, `is_latest` (as at export), `is_fixture` (1 = test row, listing URL contains FIXTURE), listing URL, snapshot id |
| `<YYYY-MM-DD>.manifest.json` | row count, rows per store, bytes, sha256, export time. A day with no rows has only this file and says MISSING |

Columns: `fetched_at_utc, style_code, brand, model, colorway, size_uk, retailer, price_inr, compare_at_price_inr, shipping_inr, in_stock, price_type, condition, is_latest, is_fixture, listing_url, snapshot_id`.

- **Source:** table `price_snapshots` (joined to `sneaker_variants`, `sneakers`, `retailers`) in Postgres `chosn_dev`.
- **Size:** about 0.5 million rows and 17 MB per day; about 1 GB for 60 days.
- **Re-running** a day overwrites that day's files with the current database contents; run it after the import ends. A run during the import gives a partial file (the manifest shows the stores).
- **Known gaps:** a store that was paused or failed that night has no rows for it; check `rows_per_store`. Test rows are included and flagged. The out-of-stock marking writes rows with `in_stock = false` and the last price; they are not price observations. Several imports on one IST day all land in that day's file.
- **Not stored here:** news and drop events (Drops and News team, tables `news_items` and `drop_events`), and the run summary (`data/daily/last_run_summary.json`).
