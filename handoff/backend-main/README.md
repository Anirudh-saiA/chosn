# Backend -> Main: REVIEW for team/backend (2026-10-27)

Branch `team/backend`, merged with `develop` at `127db16` (with Security's SEC-14; my rate-limit guard is a superset and their tests are kept in `rate-limit.guard.sec14.spec.ts`). Nothing pushed. No migration applied: the one migration is a draft in this folder.

Gate on the branch: `tsc --noEmit`, `eslint --max-warnings=0` and the build pass; `npx vitest run` = **157 passed**. The Docker image builds and runs.

## 1. be-fixture-prices (honesty): done for the API, the nightly import is for Data

**Cause.** `market-intelligence.service.ts` picked the "current price" as the freshest snapshot of any kind and the "best" from every in-stock row, with no placeholder test. For CW2288-111 UK 11 the placeholder rows (`...FIXTURE...` listing URLs) were END Rs 112.50, Myntra 9,099, Ajio 9,199, Flipkart 9,495; Ajio's 9,199 was "current" while the real best was Crepdog 6,549. Placeholders are identified by `FIXTURE` in the listing URL (the same test search, discounts and the catalog views already use). 1,302 latest rows carry it: Ajio 279, END 371, Flipkart 475 and 177 of Myntra's.

**Fix** (`pricing/market-intelligence.service.ts`, new `pricing/real-listing.ts`):
- Every figure (best, current, the daily-best history behind the 30/90-day averages) now uses real listings only: not `FIXTURE`, fresh (within 2x the store's cadence), known rupee price.
- "Current price" prefers an in-stock offer, and falls back to the freshest real one only when nothing is in stock.
- Today's `daily_best_prices` row is removed when no real best remains, so a placeholder best written earlier today cannot linger in the average. This deletes derived rows for today only.

**Checked.** Ran the refresh for that one size on the dev database: before, current Rs 9,199 (Ajio placeholder); after, current Rs 7,495 (VegNonVeg) and best Rs 6,549 (Crepdog), `avg_30d` 6,549. 3 new tests render the refresh SQL and fail if any `price_snapshots` statement lacks the placeholder filter.

**Not done / needs Main.**
- Part 2 (Data): the nightly import marks FIXTURE rows `is_latest`. Backend does not own the import's data rules. Suggested rule for Data: never write `is_latest = true` for a listing whose URL contains `FIXTURE`, or skip those stores' rows entirely.
- Existing history is still polluted: past `daily_best_prices` rows may hold placeholder bests (e.g. END at Rs 112.50), which drag `avg_30d` down. I did not delete history. Proposal (needs a card): rebuild `daily_best_prices` for the last 90 days from `price_snapshots` with the real-listing filter.
- Until the next hourly refresh (or `npm run mi:refresh-now`), other shoes' stored summaries still hold the old values.
- The offer list on the price page still lists placeholder rows (flagged by `mode: 'fixture'`); only the readout and the shelves were changed. The brief said "same filter as the offer list": the list itself shows everything with flags, so I applied the rules the rest of the site uses.

## 2. be-budget-endpoint + Popular: done

`GET /catalog/budget?max=5000&limit=12[&sort=popular]` returns `{ max, sort, items[] }`. One item per shoe: its cheapest eligible offer (latest, in stock, not `FIXTURE`, fresh, known rupee price, at least Rs 500) at or under `max`, with `store`, `listingUrl`, `fetchedAt`, `size`, `priceInr`, `storeCount`, and `offers[]` (kind, text, code, conditions, seenAt, source; up to 8, from the store's own record, none invented) plus `offersUpdatedAt`.
- `sort=cheapest` (default) lowest price first. `sort=popular` only shoes with 2 or more stores eligible, most stores first, then price (a "Popular under Rs X" shelf: pass `max` too). `max` 500 to 1,000,000 (default 5,000), `limit` 1 to 48 (default 12); anything else is a 400.
- Speed: first version scanned every latest snapshot and took 30 to 50 s. It now shortlists from `catalog_stats_mv` (store count and lowest real price per shoe, refreshed hourly) and applies the exact rules to the shortlist only: 35 to 330 ms. Cached 5 minutes; identical concurrent requests share one query.
- Caveat for Frontend: cheapest-first leads with Rs 569 women's flip-flops and Rs 600 women's Myntra shoes. That is item 3 (sneakers only) once approved; the shelf can then add `footwear_type = 'sneaker'`.
- Not checked: the live site.

## 3. data-scope-slides: DESIGN ONLY, awaiting the card (draft: `0050_footwear_type.sql.draft`)

`sneakers.category` already exists but is a sport enum (basketball, lifestyle, running, skate) and 42,608 of 42,636 rows are empty, so the new field is **`footwear_type`** (`sneaker | slide | sandal | other`). Draft (additive, idempotent, rollback included):
- `classify_footwear(model, silhouette)`: one rule in the database, whole words only ("Landslide" is not a slide), anything that says "sneaker" stays a sneaker ("Slide Sneaker", "Sneaker Mule"), and doubt means `sneaker`. slide = flip-flop, slide, slipper, mule, clog, thong, floater, Adilette; sandal; other = boots, loafers, derby, chukka, heels, socks, bags, caps, clothes.
- A trigger classifies new and renamed rows, so no importer changes. `footwear_type_manual` lets a person override and the rule never touches it.
- Backfill of old rows in the same migration (one pass over about 42.6k rows).
- Dry run on the dev database inside a rolled-back transaction: 41,339 sneaker, 711 slide, 499 other, 87 sandal. Of the shoes in stock today: about 33,100 sneaker, 406 slide, 60 sandal and about 500 other (counted with the first version of the rule). Edge cases pass; the trigger classified a test insert correctly. Nothing was kept (rolled back).
- API work after the card (not started): `footwear_type = 'sneaker'` by default in search, browse, discounts, price-drops, similar, the sitemap params and the budget shelf, plus an admin correction endpoint.
- Founder questions: are boots and football boots "other" and out (my draft says yes)? Should slides/sandals stay reachable by an explicit filter, or vanish from the site entirely?

## 4. The pool: reproduced, partly fixed, not solved under heavy database load

- **Reproduced** with a local API (all mail and scheduler loops off) and 150 parallel cold price pages: 11 failed with `timeout exceeded when trying to connect` (waiting over 5 s; the whole burst took 11 s). Each page makes 6 queries; every one is indexed and takes about 6 ms in the database when its pages are cached, so the pool is not too small: the database is slow on cold reads (Docker Postgres, `shared_buffers` 128 MB) and the requests queue.
- **Changed (API):**
  1. Price pages are cached 20 s per shoe and size, with identical in-flight requests merged (`common/ttl-cache.ts`, 4 tests). The same page 150 times: median 5.1 s to 0.76 s.
  2. The budget shelf uses the same merge: 150 parallel requests, median about 1 s.
  3. `PG_CONNECT_TIMEOUT_MS` (new, default 15 s, was a fixed 5 s) so a burst queues instead of failing. `PG_POOL_MAX` stays 20: more connections do not add throughput on this database.
- **Not solved:** later runs on fresh random pages failed (135 of 150) because another process was running a full market-intelligence refresh (`refreshBatch`, Postgres at about 200% CPU for many minutes). That refresh is the most likely cause of the founder's 14 failures too. I did not confirm which process was running it.
- **Recommendations (need Main/founder):** (a) run the hourly refresh for changed variants only (`changedSince`), not all about 500k; (b) give background jobs their own small pool (max 3) so they cannot take request connections; (c) raise Postgres `shared_buffers` to 512 MB to 1 GB now that shm is 512 MB; (d) rerun the 150-request test when the database is idle and send me the number.

## Also on the branch (approved plan items)
- `POST /waitlist` and `POST /watch/:id/email` answer 503 if Redis is down (no cap on mail without a counter).
- `GET /health/live` (no database call); `/health` also reads `GIT_COMMIT_SHA`.
- `.env.example`: dev-safe `WAITLIST_DRIP=off`, `DROP_REMINDERS=off`, and the missing variables documented (blank values commented out, because an empty string defeats the code's defaults).
- Deploy files: `apps/api/Dockerfile` (3-stage, non-root, health check), `docker-compose.prod.yml` (migrate once, API, Redis, Caddy; Postgres external), `Caddyfile`, `.dockerignore`. Built and run: image 635 MB, answers `/health/live`, runs as `node`. The compose file has not been started and Caddy has not been tried (no domain).

## Slip to know about
Last week I booted the API with the live `.env` and its waitlist drip tried a real e-mail; Resend refused it (test mode) so none left. All local runs this week set every mail and scheduler switch off and an empty `RESEND_API_KEY`.
