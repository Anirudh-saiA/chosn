# Security findings

Newest first. Format and severity guide in office/roles/security.md. Never put a secret value here; say where it is.

### SEC-7  Error reports and logs can carry personal data and the watch id    Severity: low    Status: open
Where: apps/api/src/instrument.ts (Sentry.init with no scrubbing), apps/api/src/email/email.service.ts:25,51 and waitlist.service.ts (e-mail addresses in log lines)        Found: 2026-10-21        Owner: Back end
What: The watch id (the only credential for wishlist, alerts and e-mail binding) sits in URL paths like `/watch/<id>/email`, and the API's Sentry setup has no `beforeSend` or URL/body scrubbing, so an error or a traced request (10% sampled) can ship that id, and request bodies containing e-mail addresses, to Sentry. Log lines also print recipient e-mail addresses. The web side is better: no replay, no tracing, and no server-only env var is read in any client component (checked all 'use client' files; the only NEXT_PUBLIC values are the API/WS URLs, Sentry DSN, PostHog key and host, which are meant to be public).
Proof: code read only; I did not send a test event to Sentry (that would leave our machine).
Fix: add a `beforeSend` that replaces UUIDs in `request.url` and strips `request.data`; log a masked address or the row id instead of the address.        Verified fixed: not yet

### SEC-6  Dependency advisories (npm audit, production deps): 2 critical, 9 high    Severity: medium    Status: open
Where: root lockfile; next 16.3.4, proxy-addr, multer, @nestjs/platform-express, sharp, nodemailer, @auth/core        Found: 2026-10-21        Owner: Back end / Front end
What: `npm audit --omit=dev` reports 16 (1 low, 4 moderate, 9 high, 2 critical). The two criticals: Next.js RCE in `next/og` ImageResponse (installed 16.3.4, fixed in 16.3.6+) and proxy-addr IP spoofing via IPv4-mapped IPv6 (fixed in 2.0.8). Rated medium, not critical, because grep finds no ImageResponse / next/og use in apps/web/src, so the Next RCE is not reachable today. The proxy-addr one matters more: the API sets `trust proxy` and the rate limiters key on `req.ip`.
Proof: npm audit output from the repo root, 2026-10-21; grep for ImageResponse in apps/web/src returned nothing.
Fix: upgrade next to a patched 16.3.x, proxy-addr >=2.0.8, sharp >=0.35.5, multer >=2.3.0 (via @nestjs/platform-express), nodemailer. One branch, tests run. Not yet reviewed: dev-only dependencies and the new packages imapflow, mailparser, page-flip.        Verified fixed: not yet

### SEC-5  API sends no security headers; X-Powered-By is on    Severity: low    Status: open
Where: apps/api/src/main.ts        Found: 2026-10-21        Owner: Back end
What: `GET /health` returns `X-Powered-By: Express` and none of nosniff, HSTS or a CSP. The API serves images (`/media`) and user content, so nosniff matters.
Proof: `curl -si http://localhost:4000/health` showed only X-Powered-By, Vary, ETag and the basic headers.
Fix: add `helmet()` in main.ts and `app.disable('x-powered-by')`. HSTS only once it is behind HTTPS.        Verified fixed: not yet

### SEC-4  Public endpoints rely on per-process in-memory limits; POST /watch has none    Severity: low    Status: open
Where: apps/api/src/catalog/{watch,events,order-feedback}.controller.ts        Found: 2026-10-21        Owner: Back end
What: `/watch/:id/email` (5/hour), `/events` and `/order-feedback` use a `Map` per process: the limit resets on restart and is not shared across instances. The shared Redis `RateLimitGuard` already exists and is used elsewhere. `POST /watch` (creates a row) has no limit, so anyone can fill the table. `/watch/:id/email` sends a confirmation e-mail to any address, so many IPs can e-mail-bomb one victim.
Proof: code read; `POST /watch` returned 201 on every call from one address, with no limiter in the handler.
Fix: move these to `RateLimitGuard`; add a per-recipient-address cap (for example 2 confirmations per address per day) on the watch e-mail.        Verified fixed: not yet

### SEC-3  Default local database password is committed    Severity: low    Status: open
Where: apps/api/.env.example, apps/web/.env.example, apps/api/loadtest/chat-room-load-test.js (fallback URL), git history        Found: 2026-10-21        Owner: Back end
What: The default `postgres` dev password appears in committed files and history. Harmless on this PC, dangerous if the same value is ever used on a host. No real keys (Resend, JWT, Vercel) were found in the tree or in history (pattern search over all commits).
Proof: `git grep` and `git log -G` over key and URL patterns; matches were only the dev URL.
Fix: use a unique password on any hosted database; remove the fallback URL from the load test.        Verified fixed: not yet

### SEC-2  Live secrets sit in local .env files; the Vercel OIDC token was once printed    Severity: medium    Status: open
Where: apps/web/.env.local (VERCEL_OIDC_TOKEN, AUTH_SECRET, TOTP_ENCRYPTION_KEY, API_JWT_SECRET), apps/api/.env (Resend, affiliate tokens, VAPID private key, API_JWT_SECRET)        Found: 2026-10-21        Owner: Founder
What: The files are git-ignored (`git check-ignore` confirms) and not in history, which is good. But the brief records that an earlier session printed `.env.local`, so the VERCEL_OIDC_TOKEN, and anything beside it, should be treated as exposed. I listed key names only and did not read values.
Fix: rotate the Vercel token, and rotate AUTH_SECRET / API_JWT_SECRET / the TOTP key if that print went anywhere outside this PC. Use separate secrets on the host.        Verified fixed: not yet (a founder action)

### SEC-1  Anyone can take over another person's notification settings with just their e-mail    Severity: high    Status: open
Where: POST /notifications/identify (apps/api/src/drops/notifications/notifications.service.ts:34)        Found: 2026-10-21        Owner: Back end
What: identify() looks up an existing subscriber by e-mail and returns its `subscriberId`. That id is the only credential for `/notifications/subscriptions` (list, add, delete) and is tied to push registrations. There is no e-mail verification, so anyone who knows an address gets control of that person's subscriptions.
Proof: on localhost, two calls with the same test address (different letter case) returned the identical subscriberId, and `GET /notifications/subscriptions?subscriberId=<id>` answered for it. The address was made up; no real data touched.
Fix: handoff/security-backend/SEC-1-identify.patch (never return an existing row for an e-mail), plus a spec.        Verified fixed: not yet

## Rotation list (task 1; no values)
Rotate if the earlier print of `.env.local` left this PC or its session logs: VERCEL_OIDC_TOKEN (first; confirm in Vercel), AUTH_SECRET (signs all web sessions), API_JWT_SECRET (used by both apps), TOTP_ENCRYPTION_KEY (rotating needs a re-encrypt of stored 2FA secrets, ask Back end first). Not known to be exposed but worth rotating before a public host: RESEND_API_KEY, VAPID_PRIVATE_KEY (breaks existing push subscriptions), the affiliate tokens (Flipkart, Admitad, INRDeals, Awin), and the local database password. Use new values on the host; never reuse the local ones.

## Checked and found fine (2026-10-21)
- No `.env*` file tracked or ever added to git history; no key, JWT or Resend-pattern strings in any commit.
- Every admin, community, moderation, report and block mutation route returned 401 without a token on localhost.
- Admin drops raw SQL: column names come from a fixed whitelist in `check()`, regions are checked against a fixed set before `sql.raw`. Not injectable as written.
- `/media/:folder/:file`: strict filename regex and folder whitelist; traversal attempts returned 404.
- CORS: a request with a foreign Origin got no allow header.
- Web: the only `dangerouslySetInnerHTML` is a constant CSS string in global-error.tsx.
