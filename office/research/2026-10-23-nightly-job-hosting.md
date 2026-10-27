# What does a hosted runner for the nightly price job cost per month?
**Answer / recommendation:** **Run it on GitHub Actions: ₹0 a month while the repository stays public** (about ₹140 if it were private), split into one job per store so no job nears the 6-hour limit. A Railway cron service (about ₹130 to ₹210) is the fallback, and a rented server (₹1,300 to ₹3,000) is only worth it if stores block GitHub's addresses. Before any of this, the job needs a database it can reach from outside: the nightly import writes straight to Postgres, and today that database is on the founder's PC.
**Confidence:** medium. **Why:** prices and limits are from official pages (read 2026-10-23); run-time figures are from the script's own comments; whether stores accept requests from cloud addresses is Unconfirmed until one test run.

## What the job is (read from `scripts/daily_update.py`, Confirmed)
- Scrapes Superkicks, Crepdog Crew, Mainstreet, Limited Edt, Gully Labs and Culture Circle ("quick", given as about 40 minutes by Main; the script's own comment says about 10). The full run adds VegNonVeg, Myntra and Puma, each described in the script as over an hour (Myntra "1-2 hours", Puma "about 1.5 h", Culture Circle up to 120 minutes in full mode).
- Needs Python, Node, a headless browser for Puma (Crawl4AI), and **Postgres and Redis reachable for the import step** (`import-prices --save --mark-missing`). It also writes a step log and a daily folder of CSV files.
- My monthly workload assumption: quick runs on 26 nights at 40 minutes (1,040 minutes), plus 4 weekly full runs of about 5 hours (1,200 minutes). Total about **2,240 minutes (37 hours) a month**. If the full run takes 6 or more hours, the total goes up by about 25%.

## Options compared
| Option | Cost per month (INR, 2026-10-23) | Pros | Cons | Source |
|---|---|---|---|---|
| **A. GitHub Actions scheduled workflow** (repo is public) | **₹0.** Standard runners are free in public repos. If the repo were private: 2,000 free minutes on the Free plan, then $0.006 a minute: about 240 extra minutes ≈ $1.44 ≈ ₹140 at ₹96.5 per US$. | No server to run. Free. Logs and a history of runs. Parallel jobs. Already in use for CI. | 6-hour limit per job, so the full run must be split per store. Scheduled runs can be delayed at busy times (start of the hour) or dropped under high load. A public repo's scheduled workflows are switched off after 60 days with no repo activity. Logs are public in a public repo, so secrets must stay masked. Cloud addresses may be blocked by stores (Unconfirmed). | [GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions), [runner prices](https://docs.github.com/en/billing/reference/actions-runner-pricing), [limits](https://docs.github.com/en/actions/reference/limits), [schedule event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) |
| **B. Railway cron service** (same project as the API) | **≈ ₹130 to ₹210.** Working: Railway charges $10 per GB-month of RAM and $20 per vCPU-month. A 1 vCPU, 1 to 2 GB job for 37 hours ≈ $1.35 to $2.20. This assumes a cron service is billed only while it runs, which Railway's cron page implies but does not state (Unconfirmed). | Sits next to the database, so the import is fast and private. Same bill as the API. | Needs a Docker image with Python, Node and a browser (the repo has no Dockerfile). A run is skipped if the last one is still going. Schedules are in UTC and can drift a few minutes. | [Railway plans](https://docs.railway.com/pricing/plans), [cron](https://docs.railway.com/reference/cron-jobs) |
| **C. Rented server, always on** (Hetzner) | Germany CPX12 (1 vCPU, 2 GB) €11.99 ≈ ₹1,320; Singapore CPX22 (2 vCPU, 4 GB) €26.99 ≈ ₹2,970. Excludes VAT. At ₹110 per euro (July 2026 rate, stale). | No time limit. Fixed IP that stores can be asked to allow. Can run the browser comfortably. | We run the machine: updates, restarts, monitoring. Paying for 24 hours to use about 1.5 hours a night. | [Hetzner](https://www.hetzner.com/cloud/regular-performance/) |
| **D. The founder's PC (today)** | ₹0 plus electricity | Already works. Residential address. | Only runs while the PC is on and logged in; a missed night means a gap in price history. | `scripts/register-daily-task.ps1` |

## What the Data and Back end teams would need for A or B
- A database that accepts outside connections (Railway offers a public TCP address for Postgres; Unconfirmed in detail). Without it, the cloud job can write CSV files but not import.
- The `DATABASE_URL` stored as a GitHub secret (or a Railway variable). Never in the repo or in logs.
- For A: a workflow with one job per store (`--only shopify`, `vegnonveg`, `mainstreet`, `limitededt`, `gullylabs`, `culturecircle`, `puma`, `myntra`), each uploading its CSV as an artifact, then one final job that pairs, cleans, runs the 70% safety check and imports. This keeps every job under 6 hours (the longest single store is about 2 hours).
- Concurrency: only one run at a time (the script already takes a lock).

## Risks and unknowns
- **Cloud addresses may be blocked or rate-limited by stores.** Not tested. The only way to know is one dry run (`--dry-run`) from a cloud runner. Do not try to get around a block (the scrapers are written to stop, not work around, a "no").
- The quick run time differs between sources (Main says 40 minutes; the script says about 10). I used 40.
- Rows are large: about 500,000 new Mainstreet rows a night in our local data (from the coverage query in the resale note). Import time and database growth will matter more than the runner.
- Prices are USD or EUR; rates used ₹96.5 per US$ (Pluang, 2026-10-21) and ₹110 per € (July 2026).

## What I would do next
1. Founder decides: GitHub Actions first (recommended), with Railway cron as the fallback.
2. Request to Data team: confirm the quick and full run times and that each store can be run alone.
3. Request to Back end: expose the production database for the import and write the workflow after the deployment decision (see `2026-10-21-deployment.md`).
4. R&D: after one cloud dry run, report which stores answered normally.
