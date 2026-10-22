# Tasks: security

Owner: the security team. Main assigns; the team updates this file and reports each evening with /team-report security.
First assigned 2026-10-21.

## Open
1. **Secrets audit.** Search the repo history and working tree for committed keys; check `.env`, `.env.local` and `apps/api/.env` handling and `.gitignore`; check nothing secret reaches the browser or logs. A `VERCEL_OIDC_TOKEN` in `.env.local` was printed once earlier and must be treated as exposed. *Done when:* findings in `office/security/findings.md` and a list of what to rotate (without any values).
2. **The two credentials.** (a) The anonymous watch id and the personal calendar link `/drops/my.ics?watch=`: guessability, leakage, what an attacker could do. (b) Admin routes `/admin/drops`, `/admin/prices` and moderation: guards, token handling, the web 404 for non-admins. Test on localhost only. *Done when:* each has findings with proof.
3. **Dependency audit.** `npm audit` for the root, `apps/api` and `apps/web`; separate real risks from noise; check the new packages (`imapflow`, `mailparser`, `page-flip`). *Done when:* a triage list with severity and the fix.

## Doing
2. **The two credentials.** (b) admin routes: no-token 401 checked on localhost, guard code read; still to do: token handling and the web 404 (web app was not running). (a) watch id and `my.ics`: started, not finished.

## Done
3. **Dependency audit** (2026-10-22): office/security/dependency-triage.md, SEC-6 updated, SEC-8 (email reader) added.
1. **Secrets audit** (2026-10-21): SEC-2, SEC-3, SEC-7 and the rotation list in `office/security/findings.md`.
