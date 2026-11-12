# Health checks

Two endpoints, both on `apps/api`, both public and unauthenticated
(deliberately — see each controller's own comment on why exposing them
doesn't leak anything sensitive). Written down here (Day 36) because
they've been used constantly for real deploy verification since Day 27
and the knowledge of what each field actually means had only ever lived
in conversation history, not anywhere a future engineer (including a
future Claude Code session) could find it.

## `GET /health`

```json
{ "status": "ok", "checks": { "postgres": "ok", "redis": "ok" }, "deployedCommit": "8e83fcf..." }
```

- `checks.postgres` / `checks.redis` — `"ok"`, `"error"`, or
  `"unconfigured"` (the corresponding `DATABASE_URL`/`REDIS_URL` isn't
  set at all — only happens in a broken local setup, never in a real
  deployment). A live Postgres/Redis connection is opened and closed on
  every call; this is a real check, not a cached flag.
- `deployedCommit` — the Railway-injected `RAILWAY_GIT_COMMIT_SHA` for
  whatever build is actually running (Day 31). `null` anywhere not
  deployed through Railway's git integration (local dev, for instance).

**Why `deployedCommit` exists:** before Day 31, this endpoint could only
prove the API *responds* — it couldn't prove which commit is actually
running. That gap let a real production outage (Day 26 → Day 30: an
unconfigured `StorageService` crashed the whole API at boot, Railway
silently kept serving a stale build, and `/health` reported `"ok"` the
entire time because the *old* code was, in fact, healthy) go undetected
for days. **After merging anything that touches `apps/api`, check this
field against the actual merge commit SHA** — if it doesn't match, the
deploy hasn't landed yet (Railway deploys can lag a few minutes behind a
push) or something is wrong with the deploy itself, not just slow.

## `GET /health/fetch`

```json
{
  "ok": true,
  "degraded": [],
  "retailers": [
    {
      "slug": "flipkart",
      "mode": "fixture",
      "fetchEveryMinutes": 720,
      "lastSuccessAt": "2026-09-17T05:42:24.488Z",
      "minutesSinceSuccess": 41,
      "snapshots24h": 112,
      "failures24h": 0,
      "stale": false
    }
  ]
}
```

Per-retailer status for the whole price-fetch pipeline (all 6 sources).

- `mode` — `"live"` (real credentials, real HTTP), `"fixture"` (no
  credentials, deterministic fixture data — never presented to users as
  a real price), or `"manual"` (Superkicks/VegNonVeg — reads
  `manual_price_entries`, a human-maintained table)
- `fetchEveryMinutes` — the source's configured cadence (12h for most
  API sources, 24h for END., 7 days/10080min for the two manual
  boutiques)
- `lastSuccessAt` / `minutesSinceSuccess` — when a snapshot last landed
  successfully
- `snapshots24h` — how many price rows this source wrote in the last 24
  hours (a rough proxy for "how much of the catalog did this source
  actually cover last cycle")
- `failures24h` — dead-lettered job count in the last 24 hours
- `stale` — true once nothing has landed within roughly two full fetch
  cycles — this is the "gone quiet" signal, distinct from `failures24h`
  (a source can have zero failures and still be stale if it's simply not
  running)
- `ok` (top level) — `false` if **any** retailer is either `stale` or
  has `failures24h > 0`. `degraded` lists which slugs tripped it.
  Checking staleness alone was a real bug once (Day 24-era): a source
  that failed every single fetch still looked `ok` because rows it wrote
  *before* breaking kept `lastSuccessAt` looking recent enough. Both
  conditions are checked together specifically to prevent that.

**A retailer with `failures24h: 0` and an old `lastSuccessAt` isn't
necessarily broken** — it might just be between cycles. A weekly-cadence
source (Superkicks, VegNonVeg) can legitimately show a `lastSuccessAt`
several days old without anything being wrong; check `stale` and
`failures24h`, not raw recency, before concluding something needs
fixing.

## Using both for real deploy verification

The actual workflow this project has used since Day 30, not a
theoretical one:

1. Merge a PR that touches `apps/api`.
2. Wait a few minutes, then `GET /health` — confirm `deployedCommit`
   matches the merge commit's SHA. If it's stale, the deploy hasn't
   landed; don't proceed to step 2 yet.
3. `GET /health/fetch` — confirm `ok: true` and nothing new in
   `degraded`.
4. If a fix specifically targets one retailer's behavior (e.g. Day 32's
   Superkicks/VegNonVeg mapping fix), the *natural* fetch cycle can be
   hours or days away. Two ways to verify sooner, both real, both used
   in this project's history:
   - `POST /admin/fetch/trigger/:retailerSlug` or `/trigger-all`
     (admin-guarded, Day 30) — forces an immediate fetch through the
     normal queue, same concurrency/backoff as the scheduled path.
   - Railway's **Console** tab on the `apps/api` service, running
     `node apps/api/dist/scripts/fetch-once.js <slug>` directly — the
     same script `npm run fetch:once` wraps locally, useful when you
     don't have (or don't want to mint) an admin auth token.
5. A forced cycle proves the fix works under a manual trigger. It does
   **not** prove it holds under normal, unforced operation — that needs
   a real re-check after the source's natural cadence has actually
   passed. Don't call a fix "durable" from a forced test alone.
