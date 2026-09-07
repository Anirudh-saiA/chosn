# Day 11 load test report

Local `next build && next start` / compiled NestJS, real Postgres +
Redis, real launch-catalog data — not a synthetic mock. Artillery
2.0.34 (see `README.md` for why, over k6). All three scenarios below
are reproducible with the configs in this directory.

## 1. Price comparison page — the real bottleneck

**First run** (`results-price-page-80rps-local-socket-limit.json`,
sustained ~80 req/s): a raw connection-rate burst this high hit this
specific Windows dev machine's own socket ceiling (752 `ECONNREFUSED`,
both app processes logged zero errors during the run — the OS refused
the connection before either process saw it). Re-run at a calmer, still
realistic sustained ~50 req/s to get a clean signal —
**Before** (`results-price-page-before-fix.json`):

| Metric | Value |
|---|---|
| p95 | **2725 ms** |
| p99 | **2952 ms** |
| median | 1466 ms |
| failures | 0 |

Zero failures, but a page that serves a single request in ~20ms locally
was taking whole seconds under concurrent load — worth chasing even
without errors.

**Root cause, found by isolating variables one at a time** (sequential
requests: fast; concurrent requests via a plain script bypassing
Artillery entirely: still slow) **— not the database, not Redis, the
page itself**: `next build`'s own output showed the route compiled as
`ƒ (Dynamic)` — server-rendered fresh on every single request — despite
`export const revalidate = 300` being set. `revalidate` alone doesn't
make a dynamic-segment page cacheable; it needs `generateStaticParams()`
so Next knows which params to pre-render. Without it, every one of the
concurrent requests queued through a fresh React render on one Node
process's single thread.

**Fix**: `generateStaticParams()` added to
`apps/web/src/app/sneakers/[styleCode]/[size]/page.tsx`, backed by a
new `GET /catalog/variants` endpoint. `next build` now shows the route
as `● (SSG)` with `Revalidate: 5m`, all 10 real launch-catalog variants
listed as pre-rendered paths. `dynamicParams` stays at its default
(`true`), so a variant added later still renders correctly on its first
request — this only changes which variants are warm on day one.

**After** (`results-price-page-after-fix.json`, same ~50 req/s profile):

| Metric | Before | After | Change |
|---|---|---|---|
| p95 | 2725 ms | **127.8 ms** | ~21x |
| p99 | 2952 ms | **347.3 ms** | ~8.5x |
| median | 1466 ms | **18 ms** | ~81x |
| failures | 0 | 0 | — |

A secondary, defense-in-depth fix landed alongside this: the Postgres
pool had no `max` set (`apps/api/src/db/db.provider.ts`), defaulting to
node-postgres's 10 — raised to 20 (`PG_POOL_MAX`, tunable). Given the
page fix above removed nearly all per-request database load from this
specific path, it's not the dominant factor in the numbers above, but
it's a real ceiling worth having fixed before Feature 3 adds more
concurrent DB-reading surfaces to the same pool.

## 2. Search endpoint

`results-search.json`, same ~50 req/s ramp, five query shapes (prefix
mid-type, whole-word, brand filter, signal filter, browse-all) mixed:

| Metric | Value |
|---|---|
| p95 | **26.8 ms** |
| p99 | **32.8 ms** |
| failures | 0 |

No fix needed — the GIN index over `search_vector` and the
`market_summaries` join hold up well within target at launch-catalog
scale. Re-check once the catalog is in the hundreds of models; that's
exactly the scale the brief said this approach should keep holding at,
not assumed to hold at forever.

## 3. Cache-miss thundering herd

The scenario the brief flagged as most likely to cause a real incident:
many users hitting a page the instant its cache expires.
`mi:v1:<DD1391-100 UK-8 variant id>` was deleted from Redis, then 100
requests/sec burst (`results-cache-miss.json`, no ramp — an instant
100/sec wall, not a gradual arrival) against that one now-cold URL.

| Metric | Value |
|---|---|
| p95 | **26.8 ms** |
| p99 | **40.9 ms** |
| failures | 0 |

Held up cleanly with no fix needed. `MarketIntelligenceService.getCached()`'s
fallback is a single indexed SELECT by primary key from the already-
precomputed `market_summaries` table (Day 9's whole point), so even 100
concurrent misses on the same key are just 100 cheap point-lookups, not
100 copies of an expensive computation — confirmed by measurement, not
assumed from the design. Cache correctly re-warmed afterward (verified
`EXISTS` + `TTL` + a follow-up read returning the right price).

## 4. Monitoring check (task 8) — found a real one, not a load-test artifact

Found by deliberately stopping the Postgres container mid-traffic, not
by the load test itself: **the API process crashed entirely and stopped
accepting any connections at all** — not a graceful per-request 500,
the whole process gone. Root cause: node-postgres's `Pool` emits an
`'error'` event when an idle client's connection drops (a database
restart, a network blip, a managed-Postgres connection recycle — all
normal operational events), and with no listener attached, Node's
default behavior for an unhandled `EventEmitter` `'error'` is to throw
uncaught, killing the process. No Sentry event, no clean log — nothing
downstream got a chance to report anything before the process was
already gone. This is a materially worse gap than a slow query: it
would have taken the whole API down on the next transient Postgres
blip, not just degraded one dependency.

**Fix**: `pool.on('error', ...)` in `db.provider.ts`, logging and
reporting to Sentry. Re-ran the identical test after the fix:

| | Before fix | After fix |
|---|---|---|
| Process survives | No — port stops listening | **Yes** |
| `/health` during outage | No response | `{"status":"ok","checks":{"postgres":"error","redis":"ok"}}` |
| A request during outage | Hangs / connection refused | Clean `500` |
| Logged? | Nothing | `[PgPool] idle client error: ...` (+ Sentry) |
| Recovery | N/A (dead process) | Automatic once Postgres is reachable, no restart needed |

`GET /health/fetch` (Day 7) was also checked during this pass and is
unaffected — it correctly reported `ok: false, degraded: ["ajio"]` from
an earlier session's deliberate test, which is useful confirmation on
its own: the endpoint reports real degraded state rather than always
returning green.

## Summary for Day 11's sign-off ask

The one result worth real concern, as asked: **the Postgres pool crash**
— not because the load test revealed it under load (it didn't need
load, a single dropped connection triggers it), but because it's the
kind of gap that stays invisible until the first real
managed-database blip in production, and its blast radius is the whole
API, not one request. Fixed and re-verified today, before Feature 3 adds
more traffic to the same infrastructure, per the brief's own framing.

The price-page rendering fix is the other one worth flagging even
though nothing "broke": zero failures don't mean zero problems if the
successful requests are slow enough to matter.
