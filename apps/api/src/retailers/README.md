# Retailer adapters

Six sources, one contract. Adding the seventh is: write the adapter,
add it to `adapter.registry.ts`, insert a `retailers` row. Nothing in
`PriceFetchService` or `PricingModule` changes.

## Current sources

| Retailer | slug | Integration | Cadence | Status |
|---|---|---|---|---|
| Flipkart | `flipkart` | Affiliate API | 12h | Fixtures — programme closed to new signups |
| Myntra | `myntra` | Admitad feed | 12h | Fixtures — awaiting network approval |
| Ajio | `ajio` | INRDeals feed | 12h | Fixtures — awaiting network approval |
| END. Clothing | `end-clothing` | Awin feed | 24h | Fixtures — awaiting Awin approval |
| Superkicks | `superkicks` | Manual | 7d | **Live** — reads `manual_price_entries` |
| VegNonVeg | `vegnonveg` | Manual | 7d | **Live** — reads `manual_price_entries` |

`GET /health/fetch` reports each source's mode (`live` / `fixture` /
`manual`), last success, and 24h failure count. A source running on
fixtures says so — fixture data is never presented as real pricing.

## Scaling check (Day 28, catalog 5 -> 28 models)

Each retailer gets its own BullMQ queue with `concurrency: 1`
(price-fetch.service.ts) — jobs within one retailer run strictly
sequentially, one at a time, never in parallel bursts, regardless of
catalog size. At 28 models Flipkart carries the most mappings (28
sneakers x 2 sizes = 56 jobs per 12h cycle); Flipkart's own documented
affiliate API limit is 20 requests/second (affiliate.flipkart.com's API
Terms of Use), so 56 sequential jobs spread across a 12-hour window is
nowhere close to that ceiling even before accounting for the 30s+
exponential backoff between retries. No polling-batch or stagger change
was needed for this expansion — the architecture already has orders of
magnitude of headroom at this scale. Four of six sources remain
credential-less fixture mode regardless of catalog size (see the table
above), so real rate-limit exposure only becomes a live question once
those affiliate applications are actually approved — worth re-checking
this section against each network's real documented limits at that
point, not assuming today's headroom still holds.

## Not built, and why

- **Adidas India** — Day 1 §01 flags "sneaker inclusion unverified" and
  §04 wants light legal review to confirm the category sits inside the
  commission structure. That's a business question; building first would
  be guesswork.
- **StockX / GOAT** — Day 1 §04 marks lawyer review REQUIRED, and
  Assumption 05 rules out automated access without a signed agreement.
  No adapter exists because no lawful fetch path does.
- **Culture Circle** — partnership must be "in writing before any
  automated fetch" (§04).
- **Nike India / SNKRS** — deferred at Day 1; ToS historically restricts
  aggregation.

## Mapping assist tool (Day 8, built retroactively during Day 28)

`mapping-assist.service.ts` — `POST /admin/mapping-assist/suggest` ranks
a human-collected batch of candidate retailer titles against one sneaker
(brand/model/silhouette/colorway/style-code, weighted Dice-coefficient
text similarity + a style-code-in-title bonus, brand as a hard gate) and
returns the top 3 with a `high`/`medium`/`no_confident_match` band.
`POST /admin/mapping-assist/confirm` is the only thing that ever writes
`retailer_product_mappings` — a suggestion never auto-confirms itself.
No live retailer crawl exists to feed it (see "No scrapers" below and
the fixture-mode table above) — a human still gathers candidate titles
by checking the retailer's page, same as every mapping through Day 20;
this tool only speeds up the confirm step from "read every title" to
"scan a ranked top-3." See `mapping-assist.service.spec.ts` for the
scoring contract.

## No scrapers, deliberately

Day 7's brief asked for scrape-based adapters "already legal-reviewed on
Day 1". Day 1 reviewed scraping and **rejected** it: `scrape` was dropped
from the `integration_type` enum entirely, and Tier 2 boutiques are
"priced manually — deliberately, not as a fallback — to sidestep
scraping-compliance risk entirely."

`ManualPriceAdapter` is what that decision looks like in code. It is also
the only adapter that works today with no credentials, since its source
of truth is a table the team maintains.

## Maintenance burden

Ordinarily scrapers would be the high-maintenance sources. With none in
the codebase, the recurring work sits elsewhere:

**Manual sources are the ongoing cost.** Someone has to check Superkicks
and VegNonVeg weekly and add rows to `manual_price_entries`. A stale
entry is treated as a *failure*, not a default — past 14 days the adapter
raises `PermanentFetchError`, which dead-letters the job and surfaces in
`/health/fetch`. That's intentional: a two-month-old price is worse than
no price, because it is confidently wrong. The monitoring doubles as the
re-pricing worklist.

**Affiliate response shapes are unverified.** All four HTTP adapters are
written against published documentation, not observed traffic, because no
credentials exist yet. Expect the first live call of each to reveal at
least one field mismatch. `raw` is preserved on every offer specifically
so that first failure is diagnosable. The shapes most likely to be wrong:

- **Awin** — stock is free text on some feeds (`"in stock"`) and 0/1 on
  others; `readStock()` handles both and treats anything unrecognised as
  out of stock rather than guessing a listing is buyable.
- **Admitad** — returns a paginated `results` array even for a single
  product, and serialises prices as strings.
- **INRDeals** — quotes both `mrp` and `offer_price`. Reading the wrong
  one would make Ajio look systematically expensive and lose it every
  comparison it should win.
