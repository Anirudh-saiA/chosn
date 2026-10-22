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
