# Day 29 — fetcher reliability audit & priority list

## Before reading this: what the Day 29 brief assumed vs. what's real

The brief this was written against described a 100-150 model catalog,
scrape-based retailer sources "flagged as fragile on Day 7," and weeks
of Sentry/PostHog data since launch. None of those are true of this
repo:

- The catalog is **28 models** (Day 28: 5 -> 28), not 100-150.
- **No scrape-based sources exist.** Day 1 reviewed scraping and
  rejected it outright — `scrape` was dropped from the
  `integration_type` enum entirely (see `retailers/README.md`, "No
  scrapers, deliberately"). Day 7 built five adapters: four affiliate-
  API/feed, two manual. Zero scrapers, so there is nothing "flagged as
  fragile" to have broken selectors.
- **Sentry and PostHog are still unconfigured** — no DSN/key set
  anywhere (confirmed against `README.md`'s own "Verified" section,
  last true as of Day 27). There is no week of alerts or usage data to
  pull, because the expansion went live yesterday and analytics were
  never wired up with real keys.

This document covers what's actually true instead: a real fetcher
health audit against live production, one real gap it found and fixed,
and a priority list built from what's genuinely known rather than
invented traffic numbers.

## 1. Fetcher health audit (real, against production)

Pulled directly from `GET /health/fetch` on
`chosnapi-production.up.railway.app`, 2026-09-13:

| Retailer | Mode | failures24h | stale | snapshots24h |
|---|---|---|---|---|
| flipkart | fixture | 0 | false | 20 |
| myntra | fixture | 0 | false | 20 |
| ajio | fixture | 0 | false | 20 |
| end-clothing | fixture | 0 | false | 10 |
| superkicks | manual | 0 | false | 0 |
| vegnonveg | manual | 0 | false | 0 |

`ok: true`, `degraded: []` — **zero fetcher failures, zero dead-letter
entries, nothing degraded.** No retailer needs a fix, a reduced polling
frequency, or deprioritizing. There is no product tradeoff to weigh in
on this round — every source is healthy.

The one real finding: `flipkart`'s `snapshots24h` (20) doesn't yet
reflect the Day 28 catalog growth — a fully-caught-up cycle should
write closer to 112 (28 sneakers x 2 sizes x 2 cycles/24h at Flipkart's
12h cadence). That's not a failure; it's the subject of the staleness
audit below.

## 2. Fix applied: on-demand fetch trigger (the one real gap)

**Root cause of the staleness above:** nothing kicks a retailer's
scheduled queue early after a catalog migration lands. Day 28's 23 new
models sat without prices for up to 12h because the only way to force
an immediate fetch was running `fetch-once.ts` by hand against a shell
with Railway credentials — fine for that session, not a real fix.

**Fix:** `POST /admin/fetch/trigger/:retailerSlug` and
`POST /admin/fetch/trigger-all` (`pricing/fetch-trigger.controller.ts`),
admin-guarded (`ApiAuthGuard` + `AdminGuard`, same pairing as every
other admin route). Enqueues through the existing per-retailer BullMQ
queue — same concurrency, same backoff, same retry rules as the
scheduled path. This never bypasses a rate limit; it only stops waiting
for the clock. `fetch-once.ts` stayed a script deliberately unauthenticated-route-unsafe
("an obvious way to get affiliate credentials rate-limited by a
stranger") — `AdminGuard` closes exactly that gap, so this is safe as
an HTTP route where the script wasn't.

Verified locally: boots cleanly, `POST` without a token returns 401
(guard chain correct); full workspace lint/typecheck/test all pass.

## 3. Queue capacity review

`price-fetch.service.ts` runs `concurrency: 1` per retailer queue —
strictly sequential, one job at a time, regardless of catalog size.
At 28 models:

| Retailer | Mappings | Jobs/cycle (x2 sizes) | Cadence |
|---|---|---|---|
| flipkart | 28 | 56 | 12h |
| myntra | 10 | 20 | 12h |
| ajio | 5 | 10 | 12h |
| end-clothing | 5 | 10 | 24h |
| superkicks | 7 | 14 | 7d |
| vegnonveg | 7 | 14 | 7d |

Flipkart's documented affiliate API limit is 20 requests/second
(confirmed Day 28 against `affiliate.flipkart.com`'s API Terms of Use).
56 sequential jobs across a 12-hour window is nowhere near that ceiling
even before the 3-attempt exponential backoff on retries is counted.
**No concurrency or worker-sizing change needed at this catalog size.**
This would only become a real question in the thousands-of-SKUs range,
or once a source actually moves off fixture mode with real per-second
limits tighter than Flipkart's.

## 4. Staleness audit (real, against production)

Queried every one of the 28 live variants' `/catalog/:styleCode/:size`
directly rather than trusting the migration succeeding:

- **5 of 28** (the original launch set) have live offers and a
  recently computed Market Intelligence summary (`computedAt` ~10:32
  UTC today, current hourly cycle).
- **23 of 28** (every Day 28 addition) currently show zero offers and
  `marketIntelligence: null` — not because anything broke, but because
  Flipkart/Myntra's last successful fetch (`lastSuccessAt`) predates
  the Day 28 migration, and their next scheduled cycle wasn't due yet
  at audit time.

This is exactly the "job succeeds but the picture is wrong" pattern
task 4 asks to catch — except here root-caused to pipeline latency, not
a broken selector (none exist) or bad data. Resolves on its own at the
next fetch cycle; the fix in §2 means it doesn't have to wait for one
again next time.

## 5. Real usage data review

Not performed — there is no real data. `NEXT_PUBLIC_POSTHOG_KEY` and
`SENTRY_DSN` are unset in every environment (verified against
`README.md`'s Vercel/Railway specifics, still accurate). Any "View Deal
click-through by retailer" or "search queries with no results" number
here would be invented, which is the exact failure mode this whole
audit exists to avoid. Setting up real keys is priority #1 below,
specifically so the next version of this section can be genuine.

## 6. Prioritized next steps (data-backed where data exists, reasoned where it doesn't)

1. **Configure real Sentry + PostHog keys.** Everything task 5 asked
   for depends on this existing first. Today's "priorities" below are
   architectural/completeness reasoning, not usage evidence — that gap
   closes the moment real keys exist and a week of traffic accumulates.
2. **Extend Ajio/END. Clothing mappings to the 23 new models.**
   Flagged as a fast-follow in the Day 28 commit and still true —
   those two sources only cover the original 5 launch models today.
   This is real, known-incomplete coverage, not a guess.
3. **Confirm the Day 28 pipeline lag actually clears** — re-check
   `/health/fetch` and the staleness audit above once Flipkart's next
   cycle fires (~6h from Day 28's deploy) to close the loop on the one
   open finding in this document.
4. **Once real analytics exist, re-run task 5 for real** — page
   traffic, View Deal CTR by retailer, post-type engagement, no-result
   search queries. This is what should actually drive the *next*
   catalog expansion's model list, not founder intuition (same
   principle Day 28's own brief argued for, just not yet possible to
   execute honestly).

No retailer is being deprioritized or removed — nothing in this audit
found a source unhealthy enough to warrant that call.
