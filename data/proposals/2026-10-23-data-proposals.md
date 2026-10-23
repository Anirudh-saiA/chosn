# Data team proposals, 2026-10-23

Written proposals only. Nothing here was applied to core.py, the API or the database. Owners: Back end for 2 to 4; the founder for 1 and for the fixture rows.

## 1. HTTP 429 on Superkicks, Crepdog Crew and Limited Edt (politeness: founder decides)
**Evidence.** From `logs/daily-*.log` and `data/webscraper/state.json`:
- Full Shopify reads (Superkicks + Crepdog Crew in one process, Limited Edt separately) ran 21 Oct 02:00 (3 min), 21 Oct 11:31 (3 min), 22 Oct 11:07 (6 min). All succeeded.
- 23 Oct 02:00: Limited Edt answered 429 after 122 s; Superkicks at 02:05; Crepdog Crew at 02:13. The Superkicks/Crepdog process took 801 s (against 184 s earlier) before it stopped, so the sites were slowing it down before the block. Nothing was read from either store, so 23 Oct has no rows for the three.
- The built-in pauses end 24 Oct 02:02 (Limited Edt), 02:05 (Superkicks) and 02:13 (Crepdog). The 24 Oct nightly starts at 02:00, so it will skip all three again unless the pause is cleared or the run starts later. (Nightly's call; I have not touched `state.json`.)
- Pacing today (`scripts/webscraper/core.py`): `MIN_DELAY` 1.5 s; `DOMAIN_DELAY` has Superkicks 3.0 s, Mainstreet 4.0 s, Culture Circle 2.0 s. Limited Edt and Crepdog Crew have none, so they run at 1.5 s. The Shopify scraper reads about 28,000 Superkicks rows in 3 minutes, which means catalogue pages, not product pages, at a high volume.
- Count of full-catalogue reads per store in the 36 hours before the block: three (21 Oct x2, 22 Oct).

**Proposal (not applied).**
1. One full read per store per day: skip a store if its last complete read is under 20 hours old, unless `--force`. This alone removes the 21 Oct 11:31 and the 22 Oct 11:07 extra reads, which were reruns after failures.
2. Add `DOMAIN_DELAY` of 3.0 s for `crepdogcrew.com` and `limitededt.in` (as Superkicks).
3. After the first 429 in a run, back off and stop only that store (already done), and add a per-store log line of requests made before the block so the safe volume can be measured.
Unknown: neither site publishes a limit, so the safe rate is not proven. These steps lower the load; they do not guarantee no 429.

## 2. `price_type` and a retailer kind (Back end)
Current state: every one of 3,240,393 snapshots is `price_type = retail`, `condition = new`. The `price_type` enum already has `resale` and `auction`.
- **Smallest change:** on import, set `price_type = 'resale'` for retailer slugs `mainstreet-marketplace` and `culture-circle`. The cleaned CSV has no such column today (`clean_price_csv.py` keeps the scrapers' columns), so either import-prices / price-import.service maps by slug, or Data adds a `price_type` column to the CSV and the importer reads it. Data can add the column on request.
- **Better:** a `kind` column on `retailers` (`retail`, `marketplace`, `consignment`) so Crepdog Crew (retail plus consignment) is classed once and the Compare "best price" can exclude non-retail by kind. Existing rows get fixed by one UPDATE of `price_type` joined to `retailers.kind`.
- `condition` stays `new` until a scraper can supply it; Mainstreet's "Certified Thrift" shoes may be sitting in "new" rows.
- Result to quote: marketplace price is 1.2 to 1.35 times the cheapest store price for the same style code and size, depending on whether Crepdog counts as retail; 1.30 for 2,947 pairs excluding fixtures and Crepdog. Query: `office/research/sql/q4-3-instock-by-brand.sql` (team/rnd) with `AND s.listing_url NOT LIKE '%FIXTURE%'`.

## 3. Refresh `sneakers.retail_price` (Back end applies; Data supplies the numbers)
Problem: 153 of 41,000 shoes have a `retail_price`, 23 of them last updated before 20 Sep. Samba OG B75807 has 9,350 while Superkicks, VegNonVeg and Limited Edt list 10,999 (Mainstreet's own compare-at is 10,999).
Proposal: a read-only Data script writes `data/ml/retail_price_refresh/proposed.csv` (style_code, current, proposed, source stores, n stores) where proposed = the most common in-stock price across non-marketplace, non-fixture stores, only when at least 2 stores agree. Back end reviews and applies it with an UPDATE; Data does not write to `sneakers`. Not built yet.

## 4. Duplicate current rows (Back end)
70 shoe/size/store combinations have two or three rows with `is_latest = true` (Superkicks 65, Limited Edt 5). Same price and URL in each group; the extra rows are out-of-stock markers written 17, 19, 20, 21 Oct and 22 Oct. All are in `price_snapshots_2026_10`.
Probable cause (not proven): two writers overlapping. `PriceSnapshotService.recordMany` clears `is_latest` and then inserts in one transaction; under READ COMMITTED a second import or the out-of-stock marking running at the same time does not see the other's uncommitted row, so both end up current.
Proposal: take `pg_advisory_xact_lock` on the retailer id at the start of `recordMany`/`record`; and a one-off cleanup that keeps only the newest `is_latest` row per variant and retailer:
```sql
-- review first: SELECT count(*) FROM (...) ; run only after Back end signs off
UPDATE price_snapshots ps SET is_latest = false
FROM (SELECT id, fetched_at, row_number() OVER (PARTITION BY sneaker_variant_id, retailer_id ORDER BY fetched_at DESC) rn
      FROM price_snapshots WHERE is_latest) d
WHERE ps.id = d.id AND ps.fetched_at = d.fetched_at AND d.rn > 1;
```
Expected: 100 rows changed (70 groups, 170 rows with the extras counted as 100). Re-run the count afterwards; it should be 0 groups.

## 5. VegNonVeg blank prices (Data / scripts/crawl)
`scripts/crawl/vegnonveg.mjs` line 55 takes the first `p span` as the price and still writes rows when it is empty (seen 21 Oct: a Puma LA FRANCE RNR CAMO, 5 rows). The clean step drops them, so nothing bad reaches the database. Proposed change: skip a page with no price, and log it. `vegnonveg.mjs` is not a `scrape_*` file, so I left it for Main to say whose it is.

## 6. Fixture rows
1,124 current rows (ajio 279, end-clothing 370, flipkart 475, myntra 177) have FIXTURE listing URLs. Founder decides whether to delete them; until then analysis excludes `listing_url LIKE '%FIXTURE%'`.
