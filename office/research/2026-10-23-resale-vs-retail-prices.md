# Are resale-marketplace and retail-store prices for one style code comparable?
**Answer / recommendation:** **Not directly. Do not put them in one "best price" ranking.** In our local database, for the same style code and the same size, the Mainstreet Marketplace and Culture Circle price is a median of 1.35 times the cheapest store price (both sides in stock), and more than 2 times in 1 pair out of 5. The two kinds of listing are different products at different risk: a marketplace pair is bought from a third-party reseller, with the site's own authentication, and for Mainstreet with no returns. Show them in a separate "resale / marketplace" lane next to the retail prices, label them, and keep them out of the Buy now / Wait outlook for retail until the Data team can say which listings are new, deadstock or used.
**Confidence:** medium. **Why:** the numbers are exact for our local data on 2026-10-22/23, but the database has no resale label and no condition, so "marketplace" is my grouping, and the local data is a partial scrape.

## Method (Data team: please check)
- Read-only queries on `chosn_dev`, run as `docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' chosn-postgres-1 psql -U postgres -d chosn_dev -X < file.sql`. The setting `default_transaction_read_only` returned `on`. Queries are in `office/research/sql/q4-1` to `q4-4`.
- Rows: `price_snapshots` with `is_latest`, currency INR, price above 0, fetched in the last 4 days; joined to `sneaker_variants` (size) and `sneakers` (style code, brand, model).
- A "pair" = one style code in one size (size, size system and region equal) that has a listing in both groups. Marketplace side = lowest price at Mainstreet or Culture Circle. Store side = lowest price at Superkicks, VegNonVeg, Myntra, Ajio, Flipkart, Puma India or Limited Edt. Crepdog Crew, Gully Labs and END. Clothing were left out of the pairs (Crepdog sells both retail and consignment, Gully Labs has no pairs, END. is in pounds).
- **Important database fact (Confirmed from the data):** every price row is stored as `price_type = retail`, `condition = new`. No row is marked resale. The words "marketplace" and "resale" exist only in the retailer names. The `price_type` enum has `resale` and `auction`, but nothing uses them.

## Results (Confirmed for our local data, 2026-10-22/23)
Coverage of latest rows, last 4 days: Mainstreet 355,713 rows (25,465 style codes); Culture Circle 54,112 (4,002); Superkicks 29,853 (5,865); Myntra 12,314 (1,672); Crepdog Crew 23,547 (2,710); VegNonVeg 4,360 (808).

| Cut | Pairs | Style codes | Marketplace price ÷ store price (median) | Marketplace cheaper | Within ±20% | Over 2× |
|---|---|---|---|---|---|---|
| All, any stock (q4-2) Mainstreet | 10,251 | 1,627 | 1.86 | 10% | 20% | not run |
| All, any stock (q4-2) Culture Circle | 179 | 24 | 1.61 | 8% | 20% | not run |
| Both in stock, all brands (q4-3) | 3,238 | 558 | 1.35 | 20% | 38% | 20% |
| Nike | 1,308 | 217 | 1.51 | 12% | 28% | 24% |
| Jordan | 469 | 64 | 1.24 | 18% | 48% | 19% |
| adidas | 793 | 168 | 1.11 | 43% | 54% | 12% |
| New Balance | 455 | 68 | 1.30 | 14% | 42% | 9% |
| ASICS | 157 | 32 | 1.81 | 1% | 7% | 37% |
| Converse | 47 | 7 | 2.10 | 0% | 0% | 81% |

Examples, median across sizes, in stock (q4-4): Nike Dunk Low DD1391-103: stores ₹6,999, marketplace ₹15,199 (our recorded retail price ₹9,350). Samba OG B75807: stores ₹6,999, marketplace ₹9,299 (₹9,350). Air Jordan 1 DZ5485-612: stores ₹11,574, marketplace ₹38,799 (₹15,300). Samba B75806: stores ₹9,574, marketplace ₹9,299.

## What each marketplace says it is (Reported; brand's own pages, read 2026-10-23)
| Site | Self-description | Condition | Returns / fees | Source |
|---|---|---|---|---|
| **Mainstreet Marketplace** | "acts solely as a reseller"; has "Consign" and "Seller Policy" pages (not read). Homepage says "verified". | Not stated on the pages I read. A "Certified Thrift" section suggests some used items. Unconfirmed. | "unable to accept returns, exchanges, or offer refunds once a sale is made", with exceptions for damaged or wrong items. No fees stated on pages read. | [refund policy](https://marketplace.mainstreet.co.in/policies/refund-policy), [home](https://marketplace.mainstreet.co.in/) (no page date) |
| **Culture Circle** | "a marketplace for 100% authentic sneakers, streetwear and luxury fashion", sourced from "verified sellers", authenticated with CheckCheck (30-point check, certificate). | Not stated. Unconfirmed. | 3% deducted on refunds and cancellations; partial cash on delivery needs a 15% advance online; dispatch 7 to 12 working days. Refund-window text conflicts across pages (48 hours, 72 hours, "ten days"). | [home](https://www.culture-circle.com), [about](https://www.culture-circle.com/about-us), [shipping policy](https://www.culture-circle.com/shipping) (effective 1 Nov 2025) |

- **Reported:** Inc42 (12 Jun 2025) says Mainstreet "did not hold any inventory" and sourced from resellers only after payment; it reports seller dues of ₹3 lakh to ₹25 lakh, delayed orders, refusals of refunds, and the Delhi store and warehouse closed. The founder is quoted as saying cash-flow problems are being fixed. Inc42 could not verify the debts. [Inc42](https://inc42.com/features/how-kunal-shah-backed-mainstreet-hung-up-its-shoes/). I have not checked whether this is still true in October 2026.
- **Consequence for the data:** a Mainstreet price may be a seller's ask that the site then sources after payment, so "in stock" means "listed", which may not be confirmed stock. This is my inference from the Inc42 description.

## Why the gap exists (Unconfirmed; inference)
- Marketplace prices include a reseller margin and sometimes a hype premium (Jordan 1, Dunk Low, Converse 70). adidas Samba shows near-parity because stock is easy to get at retail in India.
- Retail rows may be for different colourways of the same style code in rare cases, but style code is unique per colourway in our table, so I do not think this is the main cause.
- Size labels are matched on size, system and region equality. A mismatch in how the two scrapers map sizes could create false pairs. Not checked.

## Options for the product
| Option | Pros | Cons |
|---|---|---|
| A. Separate lane, labelled "Marketplace / resale" (recommended) | Honest; matches how users think about resale | Needs a retailer-level flag |
| B. Mix into one best price | Simplest | A user sees a ₹38,799 pair as "cheapest" or the reverse, and gets different return rights |
| C. Exclude marketplaces | Cleanest retail history | Loses the "what is it really worth" signal |

## Risks and unknowns
- The scrape is partial and 4 days old; ratios will move. The Data team should re-run q4-3 weekly.
- No condition field: used pairs at Mainstreet ("Certified Thrift") may be in the "new" rows.
- Culture Circle pairs are few (179), so its ratio is weak evidence.
- Crepdog Crew was not paired; it mixes retail and consignment and needs its own check.

## What I would do next
1. Request to Data team: set `price_type = 'resale'` for Mainstreet and Culture Circle rows (the enum already exists), and check the method above.
2. Request to Back end: show a separate lane and exclude resale rows from the retail best price. Ask Main first.
3. R&D follow-up: find each site's seller/consign policy to learn whether prices are seller-set and what is new versus used.
