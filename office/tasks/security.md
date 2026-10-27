# Tasks: security

Owner: the security team. Main assigns; the team updates this file and reports each evening with /team-report security.
First assigned 2026-10-21.

## Open
4. **Verify SEC-1** once Back end applies the patch: same request must return two different ids.
5. **Inputs and abuse.** CSV price importer, Playwright PDF renderer, magazine PDF route, community posts, chat, comments (injection, size, rate limits). Localhost only.
6. **Web accounts.** Password reset, 2FA, account enumeration, rate limits; needs a test admin session from the founder.
7. **Privacy (technical).** What personal data we store, retention, deletion path, PostHog consent.

## Doing

## Done
2. **The two credentials** (2026-10-22): SEC-9, SEC-10 (watch id and calendar link), admin checks recorded in findings.md. Open follow-up: test with a real admin session and a valid non-admin token.
3. **Dependency audit** (2026-10-22): office/security/dependency-triage.md, SEC-6 updated, SEC-8 (email reader) added.
1. **Secrets audit** (2026-10-21): SEC-2, SEC-3, SEC-7 and the rotation list in `office/security/findings.md`.

## FOUNDER-TASK 2026-10-27: look for bugs that need fixing
The founder asks Security to check the whole project for bugs and security problems that need a fix. Repo: D:\CHOSN\chosn (develop, 6629550). Cover the API (apps/api), web (apps/web), scraper and news scripts (scripts/), and secrets handling. Known open items to include: Railway Postgres password was shown in chat (reset needed), rotate VERCEL_OIDC_TOKEN, AUTH_SECRET and API_JWT_SECRET before launch, a tracked .pyc file in scripts/__pycache__.
Report to Main as REVIEW: a ranked list (severity, file:line, how it fails, the smallest fix, Confirmed / Reported / Unconfirmed). Do not fix and do not push. Each fix goes to Main as a card on CHOSN Approvals. Write the report to office/security/bug-check-2026-10-27.md.


## Main to Security 2026-10-27: patches applied on develop (not pushed)
SEC-1 0c8678c, SEC-14 85bd823, SEC-13 9e52661, SEC-6 fa4231a, news limits 509f7c7, SEC-12 1ed2ea9, pyc untracked 4ab6116 (Nightly's version instead of your patch 6). tsc, eslint clean; 118 tests pass; API rebuilt, health ok. Your next steps: re-run your proofs and mark them verified in office/security/findings.md. Still open: DB and Redis passwords, API and web dev servers on 0.0.0.0, dependency upgrades, remove file-type from package.json. SEC-9, 4, 5, 7: send as REVIEW with a proposed card each.

