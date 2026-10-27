# R&D hand-off (2026-10-27) compared with data/research (2026-10-27)

R&D's six CSVs are in `D:\CHOSN\chosn-rnd\office\research\handoff-to-data\` on team/rnd. Data had already built its files from the same notes.

| R&D file | Result |
|---|---|
| `india_mrp.csv` (59) | Richer than `mrp_india.csv` (gender, sale price, more colourway rows). Kept verbatim as `mrp_india_rnd.csv`; `mrp_india.csv` stays as the range summary. Four rows flagged in `data_check` (below) |
| `origin_materials.csv` (13) | Same facts as `specs_origin.csv`, plus midsole, outsole and manufacturer columns. Kept as `origin_materials_rnd.csv`. No disagreement |
| `marketplace_vs_store.csv` (9) | Identical numbers to the R&D rows in `resale_vs_retail_ratios.csv`. Nothing added. Data's extra rows (fixtures excluded, Crepdog included) are in the Data file only |
| `store_social_handles.csv` (11) | Same handles and labels; Data's file has 9 more rows (Facebook, YouTube, Mainstreet X, Crepdog X, Limited Edt X). No disagreement |
| `costs_inr_per_month.csv` (9) | Same options and numbers. Labels differ in kind only: R&D marks rate cards Confirmed and totals by what they are; Data marks every total or estimate Unconfirmed. GitHub Actions source link differs (R&D: billing reference page; Data: the billing overview). No change to numbers |
| `competitors.csv` (4) | Subset of Data's 9 rows. One number differs: KicksWorthy "about 290 pairs" (R&D CSV) vs "about 300" (the research note). Data's file shows both |

## Where they disagree (not resolved; not re-read from the brand pages)
1. **Puma Speedcat style code.** R&D MRP file: `40600401`; R&D origin file: `406004_01`; the page is `406004`. Our Puma codes are written `406004 01`. Use that after a look at the page.
2. **Samba OG sale example.** The note says Rs 7,199.50 on an Rs 11,999 pair; the CSV says Rs 8,399.50 for the same pair. Treat the sale price as Unconfirmed. (Sale prices are markdowns, not MRP.)
3. **Puma Speedcat Go.** Data's first file put 5,999 as the MRP; R&D has MRP 7,999 and sale 5,999 (the note says "marked down from 7,999"). R&D is right; `mrp_india.csv` is corrected.
4. **ASICS ATMOS x GEL-1130 RE style code** `1203A429-021` is not in the research note and differs from our scraper format `1203A429.021`. Inferred.
5. **New Balance 550** `BB550` is a model code, not a style code; the price is Reported (Amazon.in MRP via a tracker).
6. **KicksWorthy pair count:** 290 vs 300 (above).

Nothing was written to the database. The `retail_price` rule from R&D is adopted: never write one MRP per model into `sneakers.retail_price`; only style-code rows are exact.
