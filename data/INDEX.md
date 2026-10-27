# Where the data lives (the one-place map)

Everything is under `D:\CHOSN\chosn\data` (main checkout, git-ignored except small documents) or in the local Postgres `chosn_dev`. Updated by the Data team 2026-10-27.

| What | Where | Notes |
|---|---|---|
| **Prices, every store, every run (the 60-day dataset)** | table `price_snapshots` (Postgres `chosn_dev`) and **`data/daily-snapshots/<date>.csv.gz`** + `<date>.manifest.json` | One file per IST day; the store name sits right after the price. Day 1 (2026-10-27) is partial and frozen as the reference point |
| Raw scraper output per run | `data/daily/<date>/` (one CSV per store, `merged`, `paired`, `clean`, `clean-dropped`, `pair_report.json`) | Kept for audit; overwritten only by a re-run of the same date |
| Run summary and last-run files | `data/daily/last_run_summary.json`, `news_last_run.json`, `backup_last_run.json` | Overwritten each run; key numbers go into `office/data-run/LOG.md` |
| Best price per day, Buy now / Wait log | tables `daily_best_prices`, `outlook_log`, `outlook_latest`, `market_summaries` | In the same database |
| Scraper memory (pauses, checkpoints) | `data/webscraper/` (`state.json`, Puma and Culture Circle checkpoints) | Do not edit by hand |
| Research facts as data | `data/research/` (README lists files) | Source and Confirmed / Reported / Unconfirmed on every row |
| Datasets for the later models | `data/ml/<name>/README.md` (`price_history` so far) | Documented before use |
| Proposals (not applied) | `data/proposals/` | Includes `resale-flag/` (parked) and the retail_price backup |
| News, drops, magazine, releases | `data/media/`, `data/releases/`, tables `news_items`, `drop_events` | Drops and News team |
| Trust signals | `data/trust/` | |
| Reports | `data/reports/` | |
| Waitlist | `data/waitlist/waitlist.xlsx` | Personal data: not for any dataset or model |

Store names in the snapshots: Ajio*, Crepdog Crew, Culture Circle, END. Clothing*, Flipkart*, Gully Labs, Limited Edt, Mainstreet Marketplace, Myntra, Puma India, Superkicks, VegNonVeg (*= test data only today, see `is_fixture`).
