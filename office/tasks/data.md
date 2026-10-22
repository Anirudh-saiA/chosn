# Tasks: data

Owner: the data team. Main assigns; the team updates this file and reports each evening with /team-report data.
First assigned 2026-10-21.

## Open
1. **Puma India scrape failed on 2026-10-21** (exit 1, about 5.4 hours in) and was left out of the re-run. Find out why from `logs/daily-2026-10-21.log` and `scripts/scrape_puma_prices.py` and fix it, or report that it needs a different approach. *Done when:* a run of that scraper completes, or the cause and options are in your report.
2. **Same store, same size, listed twice.** The price tiles in Compare showed two Superkicks entries for one shoe and size (the UI now shows only the best one). Find out in `price_snapshots` and the pairing step whether these are real duplicate listings or a pairing bug, how many there are per store, and recommend the fix. *Done when:* counts per store and a recommendation.
3. **Price-history inventory for the future model.** For the price-forecast dataset: how many days of snapshots exist per shoe and size, how many shoes have 7, 30 and 60 or more days, the gaps, and when we will have enough. Write `data/ml/price_history/README.md` (columns, source, row counts, known gaps). *Done when:* the README exists with real numbers from the database.

## Doing

## Done
