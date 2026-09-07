# Market Intelligence

Turns `price_snapshots` into the numbers the price page shows —
precomputed hourly into `market_summaries`, never aggregated live on a
request. `GET /market-intelligence/:sneakerVariantId` is the only read
the frontend needs; it never joins or aggregates.

## The numbers, defined

| Field | Definition |
|---|---|
| `currentPrice` | Effective price of the **freshest** valid snapshot across retailers, regardless of stock. "What does this cost right now." |
| `bestAvailablePrice` | Effective price of the **cheapest in-stock** valid snapshot across retailers. "Where would I actually buy it." |
| `avg30d` / `avg90d` | Average of `daily_best_prices.best_price_inr` over the last 30 / 90 calendar days — the average of what a buyer could actually get each day, not an average of every offer from every retailer. |
| `trendPct` | `(bestAvailablePrice - avg30d) / avg30d`, as a **percentage** (e.g. `-5.23` means 5.23% below the 30-day average). |
| `signal` | See thresholds below. |
| `daysHistory30d` / `daysHistory90d` | How many real `daily_best_prices` rows fed the average — a variant added last week does not silently get a 90-day figure padded from 4 days of data. |
| `sufficientData` | `daysHistory30d >= MIN_DAYS_FOR_SIGNAL` (7). False means `signal` is `'insufficient_data'`, not a guess. |

`currentPrice` and `bestAvailablePrice` are deliberately allowed to
differ — see the hand-check in the verification report for a real
example where the freshest offer (Ajio) isn't the cheapest one (Myntra).

## Effective price and currency

`effective_price_inr(price, shipping_cost, currency)` (SQL function,
`0004_market_intelligence.sql`) is the **one** definition of "effective
price" — price plus shipping, converted to INR — and every ranking or
average in this layer calls it rather than reimplementing the
arithmetic. It returns `NULL` (not a wrong number) when the currency has
no `fx_rates` row, so an unconverted offer is excluded from ranking
rather than compared to INR as if the numbers meant the same thing.

Conversion happens here, at read time — never by rewriting
`price_snapshots`. Day 1 Assumption 02 is explicit that a stored
conversion silently goes stale with no way to recover what was actually
quoted (see `awin.adapter.ts`), so the raw table stays untouched.

**Known limitation:** `fx_rates` is a static, manually-maintained table
(currently `INR` and `GBP`, since END. Clothing is the only non-INR v1
source). There is no live FX feed. `MarketIntelligenceService` logs a
warning each refresh if any `is_latest` snapshot's currency has no
`fx_rates` row, so a gap is visible rather than silent — but the rate
itself needs a human to update it periodically.

## Staleness

Both `currentPrice` and `bestAvailablePrice` only consider each
retailer's `is_latest = true` row, and only if it was fetched within
**2x that retailer's own `fetch_frequency_minutes`** — a 12h feed goes
stale after 24h of silence, a 7d manual entry after 14 days. A retailer
that has gone quiet stops contributing a price at all rather than
contributing an increasingly wrong one.

## Buy / Neutral / Wait thresholds

**ASSUMPTION — FLAGGED FOR SIGN-OFF.** These are the exact numbers the
Day 9 brief itself proposes, adopted as-is because they become
user-facing copy directly. Change them in
`market-intelligence.service.ts` (`SIGNAL_THRESHOLDS`) and every
downstream number follows on the next hourly refresh.

| `trendPct` | Signal | Suggested copy |
|---|---|---|
| ≤ -5% | `good_time_to_buy` | "Good Time to Buy" |
| -5% to +5% | `neutral` | "Neutral" |
| ≥ +5% | `consider_waiting` | "Consider Waiting" |
| *(fewer than 7 days of history)* | `insufficient_data` | "Gathering price history" |

`MIN_DAYS_FOR_SIGNAL = 7` is a second assumption bundled with the same
sign-off request: fewer real days than that and a "trend" is noise, not
a claim CHOSN should put a buy/wait label on.

## Caching

`MarketIntelligenceCacheService` is a cache-aside wrapper around
`market_summaries`, keyed `mi:v1:<sneakerVariantId>`, TTL 3600s — matched
to the hourly refresh, so a cached row is never older than one cycle.
The hourly refresh also writes through on every recompute, so a miss
should mean a cold key or an eviction, not routine traffic. A Redis
error fails open to Postgres (same shape as `RateLimitGuard` elsewhere)
rather than 500ing the price page.

Verified locally: cache miss ~40ms, cache hit ~12-16ms, both against the
`GET /market-intelligence/:id` endpoint — see the verification report.

## Scripts

```
npm run mi:backfill --workspace=@chosn/api   # one-time: populate daily_best_prices from history
npm run mi:verify   --workspace=@chosn/api   # Day 9 task 7 verification report
```

`mi:backfill` uses an as-of LATERAL join (latest snapshot per retailer,
as of each past day's end) to reconstruct `daily_best_prices` for days
that existed before the hourly job started running. The hourly job
itself never needs this — it only ever writes *today's* row, using
`is_latest` directly, which is cheap. Safe to re-run; every write is an
upsert.

`mi:verify` re-derives `currentPrice` / `bestAvailablePrice` in
independent TypeScript (not by calling `effective_price_inr()` again)
for real launch-catalog variants, diffs against `market_summaries`,
prints the full hand-worked arithmetic for one variant, and — since the
dev dataset is only hours deep — exercises all three signal buckets
against a synthetic 35-day history on an isolated scratch sneaker that
it creates and deletes in the same run.
