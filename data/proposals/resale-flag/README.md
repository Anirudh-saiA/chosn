# resale-flag: mark Mainstreet Marketplace and Culture Circle as resale (proposal, nothing applied)

Founder approved the flag (card resale-flag). Prepared 2026-10-27 by Data. **Nothing here has been run.** Main runs it.

What changes: `price_snapshots.price_type` goes from `retail` to `resale` for the two marketplaces (the enum already has `resale`). No price, stock, date or `is_latest` value changes. Today that is about 3.5 million rows (they grow with each import); every other store stays `retail`.

| File | What |
|---|---|
| `importer-resale-mapping.patch` | The importer change (Back end's file `apps/api/src/pricing/price-import/price-import.service.ts`, 4 lines): new rows from the two stores are written as `resale`. `git apply` it on a Back end branch, add a test, run the API tests. Not applied or type-checked by Data (no node_modules in the Data worktree) |
| `01_backup.sh` | Read-only. Saves `id, fetched_at, price_type, slug` of every row step 2 would change to `backup_price_type_<date>.csv` (about 3.5 million lines, a few hundred MB) and prints the count |
| `02_update.sql` | The one UPDATE, in a transaction with a check that nothing is left over and nothing outside the two stores changed. Prints `rows_to_change` first: it should equal the backup's row count |
| `03_undo.sh` | Restores the old value of every row in the backup. Rows imported after step 2 stay `resale`, which is correct |
| `04_verify.sql` | Read-only count per store and price_type |

Order: apply the importer patch first (or at least before the next nightly import, otherwise tonight's rows come in as `retail` again), then `01_backup.sh`, then read the count, then `02_update.sql`, then `04_verify.sql`.

Tested by Data (read-only): the backup query on 3 rows; `EXPLAIN` of the step 2 UPDATE plans (a seq scan of the October partition joined to the 2 retailer rows; a read-only session blocks real writes). The undo's temp table could not be created read-only, so its SQL is unrun. Row count of the change at 11:xx IST 27 Oct: 3,496,667. Not tested: the UPDATE itself, the undo end to end, the importer patch (compile and tests), run time of the UPDATE on 3.5 million rows in one transaction (could take minutes and bloat the table; run when no import is running).

**Important:** no code in `apps/api/src` reads `price_type` today (only the importer, the mark-missing step which copies it from the old row, and a verify script). Flagging the rows changes nothing a shopper sees. A separate Back end task is needed to leave `resale` rows out of the Compare best price and show them in their own lane. Until then Compare still ranks the marketplaces with the stores.
**Also not covered:** Crepdog Crew (retail and consignment) is not flagged; a retailer-level `kind` column is the better long-term place (see section 2 of `data/proposals/2026-10-23-data-proposals.md`).
