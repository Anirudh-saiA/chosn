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

## Founder rule 2026-10-27 (card rule-by-hand-scrapes, approved)
Any team that runs a scraper outside the nightly job tells Nightly first, or runs it through the nightly. Written into office/ORG.md. Reason: by-hand runs on 25 Oct returned 429 from six sites and Gully Labs was skipped on 26 Oct.


## FOUNDER-TASK 2026-10-27: (a) import the research into Data, (b) own the 60-day run storage
(a) Whatever data the research produced must be imported into Data. Sources: office/research/*.md (INDEX.md lists them: MRPs and specs, resale vs retail prices, store handles, competitors, hosting costs, real vs fake basics) and office/research/sql. For each research file, list the facts that are data (a value per shoe, per store, per brand), put them in structured files under data/research/ (CSV or JSON, with the source and a Confirmed / Reported / Unconfirmed label on each row), and write data/research/README.md. Any change to the live database goes to Main first as a card; do not write to the database without an approved card. R&D hands every new research file to Data from now on.
(b) 60-day run: read office/data-run/60-day-run.md. Day 1 is 27 Oct, day 60 is 25 Dec. You own the storage: confirm the table and file names in that plan, create data/daily-snapshots/ and write one snapshot per day. Every run adds a row to office/data-run/LOG.md naming the exact file or table where the data is stored.
Report DONE or BLOCKED to Main.

## FOUNDER-TASK 2026-10-27: VegNonVeg prices do not match the VegNonVeg website (fix and update)
The founder compared our price page with VegNonVeg: Nike Dunk Low Retro White/Black (HF5441-100). VegNonVeg's own page shows Rs 7,051 (old price Rs 8,295 struck through, inclusive of taxes). Our site shows Rs 8,295 at vegnonveg. He says the prices are not similar and asks for this to be fixed for all shoes, not just this one.
Main's check (Confirmed from the local database): our row for HF5441-100 at vegnonveg has price 8,295, compare_at_price empty, read on 25 Oct. All 4,415 current VegNonVeg rows have an empty compare_at_price, so the scraper never stores the old price. Unconfirmed: whether the Rs 7,051 sale price existed on 25 Oct (then the scraper reads the wrong field), or the sale started later (then the row is only stale). The quick daily run does not read VegNonVeg at all, so these rows may be days old.
Data (owner of the scrapers): (1) open the VegNonVeg page and the scraper output for 5 shoes and say which of the two cases it is; (2) if the scraper reads the list price instead of the sale price, fix it so price = what the customer pays today and compare_at_price = the struck-through price; (3) count how many VegNonVeg shoes differ from the live site (sample at least 50, with the list); (4) send Main a REVIEW with the fix and the counts. Do not write prices to the database by hand: the import does it.
Nightly: when Data's fix is merged, run the VegNonVeg read through the nightly script (not by hand without telling Nightly; founder rule 2026-10-26) and report the new row counts. No pacing change.
Same check afterwards for the other stores: compare 5 shoes per store against the store's own page and report any mismatch.

## FOUNDER-TASK 2026-10-27 (from Frontend, via Main): two data bugs for the budget shelf
(1) Offer text has broken characters: the rupee sign comes back as the three characters a-circumflex, euro, 1/4 mark (UTF-8 read as Latin-1) in offers[].text, for example the Crepdog Mobikwik offer. Find where the text is decoded wrongly (scraper or import) and fix it at the source. (2) A search sorted by price returned a trainer with bestAvailablePrice 569 and 1 store. List all current rows under Rs 1,500 with store and page, say which are real and which are scraper mistakes, and propose the fix. Send Main a REVIEW; no database writes without an approved card.


## FOUNDER DECISION 2026-10-27: card data-scope-slides = SNEAKERS ONLY
Stop collecting slides, flip-flops, sandals, slippers and clogs: add them to NOT_SHOES in scripts/scrape_puma_prices.py and add a title/product_type filter in scripts/scrape_shopify_prices.py and scripts/scrape_mainstreet_prices.py (your proposal). Also leave out the cheap non-sneaker brands from Myntra (Roadster, Layasa, JQR, yoho): propose the rule as a REVIEW (brand list or category), do not guess. Old rows stay as history. Ask Back end (office/tasks/backend.md) for a category field on sneakers so the site can hide old non-sneaker rows. Send Main a REVIEW; nothing is run on the stores except through Nightly.
