# Tasks: data

Owner: the data team. Main assigns; the team updates this file and reports each evening with /team-report data.
First assigned 2026-10-21.

## Open
1. **Puma India scrape failed on 2026-10-21** (exit 1, about 5.4 hours in) and was left out of the re-run. Find out why from `logs/daily-2026-10-21.log` and `scripts/scrape_puma_prices.py` and fix it, or report that it needs a different approach. *Done when:* a run of that scraper completes, or the cause and options are in your report.
2. **Same store, same size, listed twice.** The price tiles in Compare showed two Superkicks entries for one shoe and size (the UI now shows only the best one). Find out in `price_snapshots` and the pairing step whether these are real duplicate listings or a pairing bug, how many there are per store, and recommend the fix. *Done when:* counts per store and a recommendation.
3. **Price-history inventory for the future model.** For the price-forecast dataset: how many days of snapshots exist per shoe and size, how many shoes have 7, 30 and 60 or more days, the gaps, and when we will have enough. Write `data/ml/price_history/README.md` (columns, source, row counts, known gaps). *Done when:* the README exists with real numbers from the database.

## Doing
1. Apply and review: Puma resilience patch, price_history README and proposals are committed on team/data (2026-10-23), waiting for review.

## Done
- **Puma India (task 1):** cause found: the laptop slept 03:28 to 07:22 on 21 Oct (Modern Standby); the page load then timed out, `check_page` raised `NeedsRendering` and nothing caught it. Puma exits 0 on 23 Oct (3,141 rows). Patch makes empty pages a skip and stops after 10 in a row (tested on 3 live pages and a stubbed failure).
- **Blank price rows:** 5 VegNonVeg rows (one Puma product, no price on the page); the clean step drops them.
- **Duplicates (task 2):** Superkicks 65 and Limited Edt 5 shoe/size pairs have extra `is_latest` rows; proposal in `data/proposals/`.
- **Price-history inventory (task 3):** `data/ml/price_history/README.md`.
- **Resale vs retail:** 1.2 to 1.35x the cheapest store, depending on whether Crepdog counts as retail; 1.30 for 2,947 pairs excluding fixtures.

### Result 2026-10-27 (Data): VegNonVeg prices
Cause: the scraper took the first price span, which is the struck-through price on a marked-down shoe. 22 of 60 sampled live pages were marked down and all 22 were stored at the old price (37%, about 25% to 49%). Fix and counts: REVIEW to Main, commit 676dc6a; list in `data/proposals/vegnonveg-price-check-2026-10-27.csv`. The fixed read still has to run through the nightly script (Nightly). Other stores, 5 shoes each against the store's own page: Culture Circle 4 of 5 match (1 stale: 5 sizes 8,598 vs live 8,299), Puma India 5 of 5 prices match (sizes that sold out are still in stock in our rows), Myntra not checked by hand, Superkicks / Crepdog / Limited Edt / Mainstreet / Gully Labs paused (HTTP 429 until about 10:25 on 28 Oct) and not touched.
