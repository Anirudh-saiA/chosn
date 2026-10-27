# price_history: price-forecast / Buy now or Wait dataset

Numbers below are from the local `chosn_dev` database on 2026-10-23 (SELECT-only queries). Times are IST. They count real and test rows alike unless said otherwise (see "Known gaps").

## What it is
One row per price seen for one shoe, one UK size, one store, each time the nightly import runs. The table is append-only: a new row is added on each import, and the previous row only loses its `is_latest` flag.

- **Source:** `price_snapshots` (partitioned by month on `fetched_at`), joined to `sneaker_variants` (size) and `sneakers` (style code, brand, model) and `retailers` (store). Filled by `scripts/daily_update.py` through `apps/api/src/scripts/import-prices.ts`. Raw per-day files are in `data/daily/<date>/`.
- **Also useful:** `daily_best_prices` (best price per variant per day), `outlook_log` (each day's Buy now / Wait call and what prices did afterwards).
- **Not yet an export:** no training CSV has been written. Build it from the join above when there are about 60 days.

## Columns (price_snapshots)
`sneaker_variant_id` (shoe + UK size), `retailer_id`, `price` (INR, numeric 12,2), `compare_at_price` (the store's own "was" price, often empty), `shipping_cost`, `currency`, `condition` (always `new` today), `price_type` (`retail` or `resale`: Mainstreet Marketplace and Culture Circle rows were set to `resale` on 2026-10-27, 3,496,667 rows, backup in `data/proposals/resale-flag/`; before that every row was `retail`), `in_stock`, `listing_url`, `is_latest`, `fetched_at`, `image_url`.

## Row counts (2026-10-23)
| | |
|---|---|
| snapshots | 3,240,393 |
| shoes (style codes) | 41,000, of which 40,857 have a snapshot |
| shoe-size variants | 488,927 (all UK sizes, region india) |
| stores | 12 |

| Store | Rows | Variants now | Days with data | First day | Last day |
|---|---|---|---|---|---|
| Mainstreet Marketplace | 2,438,085 | 377,081 | 6 | 17 Oct | 22 Oct |
| Superkicks | 281,080 | 30,152 | 12 | 7 Sep | 22 Oct |
| Crepdog Crew | 195,645 | 23,968 | 7 | 12 Oct | 22 Oct |
| Culture Circle | 171,830 | 54,112 | 5 | 19 Oct | 22 Oct |
| Limited Edt | 57,226 | 7,235 | 5 | 17 Oct | 22 Oct |
| Myntra | 42,588 | 13,343 | 7 | 17 Oct | 22 Oct |
| VegNonVeg | 27,568 | 4,384 | 10 | 7 Sep | 22 Oct |
| Flipkart (test rows) | 7,690 | 475 | 18 | 6 Sep | 22 Oct |
| Puma India | 6,728 | 3,411 | 2 | 18 Oct | 22 Oct |
| Gully Labs | 4,760 | 595 | 6 | 18 Oct | 22 Oct |
| Ajio (test rows) | 4,056 | 279 | 20 | 7 Sep | 22 Oct |
| END. Clothing (test rows) | 3,137 | 370 | 17 | 7 Sep | 22 Oct |

(The 23 Oct nightly import has since added about 420,000 rows; "last day" above is UTC-date based for the day count and is 22 Oct in these queries.)

## Days of history
Days = distinct IST dates with at least one snapshot.

| Days of history | Shoe/size/store combinations |
|---|---|
| 1 | 42,566 |
| 2 | 18,150 |
| 3 | 31,836 |
| 4 | 16,219 |
| 5 | 32,559 |
| 6 | 336,655 |
| 7 | 36,967 |
| 8 to 20 | 453 |

Per shoe-size (any store): 488,927 total; 448,372 have 2 or more days; 430,995 have 3 or more; 38,892 have 7 or more; none have 30 or 60. Per shoe (any size or store): 40,857; 36,400 have 2 or more days; 6,484 have 7 or more; 28 have 10 or more; 0 have 30; the longest is 20 days.

Rows by day (IST): 13 Oct 41,980; 14 Oct 116; 15 Oct 621; 16 Oct 41,855; 17 Oct 539,874; 18 Oct 20,769; 19 Oct 418,704; 20 Oct 422,181; 21 Oct 883,918 (two imports); 22 Oct 448,594; 23 Oct 420,787 (partial: Superkicks, Crepdog Crew and Limited Edt were not read, see below). September has only 9 days of a few hundred rows (test data).

## When there will be enough
The bulk history starts on 16 to 17 Oct. At one import a day with no missed days, 30 days is reached about 15 to 16 Nov and 60 days about 15 Dec; 90 days about 14 Jan 2027. Every missed night pushes this back by a day, so the nightly run's reliability is what sets the date. Stores that started later (Culture Circle 19 Oct, Puma India 18 Oct) are a few days behind.

## Known gaps
1. **Thin days:** 14, 15 and 18 Oct have under 21,000 rows each (the stores were not read in full); do not treat them as "price unchanged".
2. **Stores not read on a given night:** 23 Oct nightly read no Superkicks, Crepdog Crew or Limited Edt (HTTP 429, a 24-hour pause that ends after the next 02:00 start, so 24 Oct may skip them too). A missing day is a gap, not a flat price.
3. **Test rows:** 1,124 current rows have `FIXTURE` in `listing_url` (all of Ajio, END. Clothing, Flipkart; 177 of Myntra). Exclude with `listing_url NOT LIKE '%FIXTURE%'`. Not deleted; that is the founder's decision.
4. **Duplicate current rows:** 70 shoe/size/store combinations (Superkicks 65, Limited Edt 5) have 2 or 3 rows with `is_latest = true`. The history itself is not damaged, but "latest" queries double count. Proposal in `data/proposals/2026-10-23-data-proposals.md`.
5. **Marketplaces are flagged `resale` (since 2026-10-27 ~11:10):** Mainstreet Marketplace and Culture Circle prices are asking prices, `condition` is still `new`. Keep `price_type = resale` out of a retail price model. Daily snapshot files exported before the flag show the old value: the frozen day-1 file (2026-10-27) lists Culture Circle as `retail`; in the database those rows are `resale`.
6. **Release prices:** `sneakers.retail_price` exists for 153 of 41,000 shoes and is stale for some (Samba OG B75807 shows 9,350; stores charge 10,999). Do not use it as a label.
7. **Out-of-stock marking:** when a listing disappears the importer writes a new row with `in_stock = false` and the last price. Treat out-of-stock rows as "no price", not a price.
8. **Several imports a day:** more than one import on the same IST day (21 Oct had two) is counted as one day above; use the latest of the day for daily series.
9. **Sizes:** UK only. Other size systems from the scrapers are converted or dropped by `clean_price_csv.py`.
10. **No personal data** is in this dataset.
