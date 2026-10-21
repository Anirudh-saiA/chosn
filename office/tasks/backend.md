# Tasks: backend

Owner: the backend team. Main assigns; the team updates this file and reports each evening with /team-report backend.
First assigned 2026-10-21.

## Open
1. **Baseline.** On a clean branch run `npm run build`, typecheck, lint and `npx vitest run` in `apps/api` (93 tests passed on 2026-10-21). *Done when:* the four results are in your report.
2. **Scripts must not depend on this PC.** Today these shell out to `docker exec chosn-postgres-1 psql`: `scripts/build_galleries.py`, `fetch_drop_images.py`, `fetch_news_images.py`, `image_info.py`, `merge_sneakers.py`, `scan_brand_sites.py`, `scripts/trust/collect_signals.py`, `scripts/trust/compute_trust.py`. Write one shared helper `scripts/dbconn.py` with the same `psql(sql)` behaviour that uses `DATABASE_URL` and falls back to docker only when it is unset, with tests. The scripts belong to the Data team and the Drops and News desk, so list them in your report for those teams to switch. *Done when:* the helper exists with tests and the list of scripts to switch is handed over.
3. **Rate limits on public write endpoints.** Inventory every public endpoint that writes or sends e-mail (feedback, waitlist, watch alerts, reminders, follows, community, chat); apply limits where missing; test them. *Done when:* a table of endpoint, limit and test.
4. **Deployment readiness plan (propose first, do not build yet).** A list of every environment variable the API and the jobs read, what runs on a schedule today (nightly price job, the 10-minute news cycle, the reminder loop inside the API), what an API Dockerfile and a production compose would need, and a health endpoint. R&D is pricing hosts; this is the technical side. *Done when:* a one-page plan in your report for the founder to approve.

Not yours: auditing admin routes and logging is the Security team's job; fix what they find.

## Doing

## Done
