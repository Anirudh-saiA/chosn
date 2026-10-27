# data/research: facts from the R&D research notes, as data

Every row has `as_of`, a `label` and a source (`source_url`, and `source_file` = the research note in `office/research/` it was taken from). Labels are the notes' own: **Confirmed** (the company's or brand's own page, or our own data), **Reported** (a third party), **Unconfirmed** (could not verify, or an estimate). Nothing here was added from memory; where a note gave a range, the file keeps the range. Prices are rupees including GST unless a row says otherwise. Built 2026-10-27 by the Data team from the notes dated 2026-10-21 and 2026-10-23. R&D hands every new research note to Data; add its facts here and list the file below.

| File | Rows | From | What it holds |
|---|---|---|---|
| `mrp_india.csv` | 32 | india-mrp-and-specs | India MRP per shoe, style code and scope (brand pages checked 2026-10-23). Low and high when a shoe has several prices by colourway |
| `specs_origin.csv` | 18 | india-mrp-and-specs | Materials and country of origin per style code. Origin is per style code, not per shoe |
| `corrections.csv` | 3 | india-mrp-and-specs | Values in our files that the research found wrong: Dunk Low MRP, Campus 00s upper, Samba OG B75807 `sneakers.retail_price` (9,350 vs 10,999) |
| `resale_vs_retail_ratios.csv` | 19 | resale-vs-retail-prices + Data's re-check | Marketplace (Mainstreet, Culture Circle) price over cheapest store price, same style code and UK size. `measured_by` says R&D or Data. See "Reading the ratios" |
| `resale_vs_retail_examples.csv` | 4 | resale-vs-retail-prices | Four worked style codes. All Unconfirmed: the store side may include test rows |
| `store_facts.csv` | 15 | resale-vs-retail-prices, indian-competition, india-mrp-and-specs | Per-store terms: returns, fees, dispatch, self-description, reported problems |
| `store_social_handles.csv` | 20 | store-social-handles | X, Instagram, Facebook and YouTube handles per store, each Confirmed or not |
| `competitors.csv` | 9 | indian-competition | Who else compares prices or tracks drops in India: offers, charges, gaps |
| `hosting_costs.csv` | 9 | deployment, nightly-job-hosting | Monthly cost per hosting option, in rupees, with the basis and caveat. Estimates are marked Unconfirmed |
| `authenticity_checks.csv` | 21 | real-vs-fake-basics | What each brand publishes about telling real from fake, and which common claims are only from blogs |
| `dpdp_points.csv` | 14 | dpdp-obligations | The legal points (dates, rights, penalties) with labels |

## Not turned into data
- `dpdp-obligations`: the part on what CHOSN collects and what to build is a to-do list for Back end and the lawyer, not data. Only the legal points are in `dpdp_points.csv`.
- The prose recommendations in every note stay in the notes.
- `office/research/sql/q4-1..q4-4`: the queries behind the resale ratios. They only SELECT; run them as the notes say (`docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' chosn-postgres-1 psql -U postgres -d chosn_dev -X < file.sql`). Their output is already in `resale_vs_retail_ratios.csv`. Re-run `q4-3` weekly with the fixture filter, and save the new numbers as new rows with a new `as_of`.

## Reading the ratios
- Ratio = lowest marketplace price divided by lowest store price, both in stock, for one style code in one UK size. These are **asking prices**, not sold prices.
- Headline: **1.2 to 1.35× the cheapest store, depending on whether Crepdog Crew counts as retail**; 1.30 for 2,947 pairs with test rows excluded. R&D's 1.35 (3,238 pairs) included test rows on the store side; adding Crepdog to the store side gives 1.19 (7,648 pairs). The brand order is stable: Converse, ASICS and Nike high, adidas near parity.
- Test rows: 1,124 current rows have `FIXTURE` in `listing_url` (all of Ajio, END. Clothing, Flipkart; 177 of Myntra). They are in the live database; whether to delete them is the founder's decision.

## Database changes
None made. Anything that changes the database (the `retail_price` refresh, a `resale` flag, deleting test rows, the `is_latest` cleanup) is written as a proposal in `data/proposals/2026-10-23-data-proposals.md` and goes to Main as a card first.

## Gaps
- Nothing here is checked again after 2026-10-23; prices on brand pages change daily and by colourway. Quote a style code and a date.
- 3 of 10 fact-bank shoes (New Balance 550, ASICS plain Gel-1130, Puma materials) and Yeezy 350 V2 / Superstar II have no official source yet.
- Hosting totals are the researcher's estimates, not bills.
