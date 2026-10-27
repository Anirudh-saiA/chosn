# Tasks: backend

Owner: the backend team. Main assigns; the team updates this file and reports each evening with /team-report backend.
First assigned 2026-10-21.

## Open
7. Waiting for Main/founder: card for the `footwear_type` migration (draft ready); Data to stop FIXTURE rows becoming `is_latest` in the nightly import; decision on the pool recommendations (refresh changed variants only, separate background pool, Postgres memory).
4. Deployment plan: built as far as approved (Dockerfile, compose, Caddyfile, `/health/live`). Still to do: Redis lock for the in-API loops, media to object storage, job workflows, heartbeat.
6. Review the Data team's and the Desk's switch to `scripts/dbconn.py` when handed over.

Not yours: auditing admin routes and logging is the Security team's job; fix what they find.

## Doing

## Done
- 2026-10-27 **be-fixture-prices part 1:** market readout uses real listings only. **be-budget-endpoint + Popular:** `GET /catalog/budget`, `sort=popular`. **Pool:** reproduced, cache plus longer wait added, not solved under load. **Item 3 design:** draft in `handoff/backend-main/`. Review notes: `handoff/backend-main/README.md`.
- 2026-10-27 Plan items: mail endpoints fail closed, `/health/live`, dev-safe `.env.example`, Dockerfile, production compose, Caddyfile.
- 2026-10-21 **1 Baseline:** build, typecheck and lint green; 93 API tests passed (114 after task 3).
- 2026-10-21 **2 `scripts/dbconn.py`:** helper and 8 tests; the list of scripts to switch is in the report for Data and the Desk.
- 2026-10-21 **3 Rate limits:** every public write and e-mail endpoint limited in Redis; spoofable `X-Forwarded-For` bug fixed; per-address cap on mail; 21 new tests.
