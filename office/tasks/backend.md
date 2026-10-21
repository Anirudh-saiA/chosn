# Tasks: backend

Owner: the backend team. Main assigns; the team updates this file and reports each evening with /team-report backend.
First assigned 2026-10-21.

## Open
4. **Deployment readiness plan.** Written up in `office/reports/backend/2026-10-21.md`; waiting for the founder's approval before anything is built.
5. (Proposed, needs the founder's yes) Limiter fails closed on `POST /waitlist` and `POST /watch/:id/email`; dev-safe defaults (`DROP_REMINDERS=off`, `WAITLIST_DRIP=off`) in `.env.example`.
6. Review the Data team's and the Desk's switch to `scripts/dbconn.py` when handed over.

Not yours: auditing admin routes and logging is the Security team's job; fix what they find.

## Doing

## Done
- 2026-10-21 **1 Baseline:** build, typecheck and lint green; 93 API tests passed (114 after task 3).
- 2026-10-21 **2 `scripts/dbconn.py`:** helper and 8 tests; the list of scripts to switch is in the report for Data and the Desk.
- 2026-10-21 **3 Rate limits:** every public write and e-mail endpoint limited in Redis; spoofable `X-Forwarded-For` bug fixed; per-address cap on mail; 21 new tests.
