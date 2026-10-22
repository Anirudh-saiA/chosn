# Security findings

Newest first. Format and severity guide in office/roles/security.md. Never put a secret value here; say where it is.

### SEC-10  Wishlist e-mail can be reset by anyone holding the watch id, switching off the owner's alerts    Severity: low    Status: open
Where: POST /watch/:id/email, PUT /watch/:id/items, apps/api/src/catalog/watch.controller.ts        Found: 2026-10-22        Owner: Back end
What: With only the watch id, a caller can replace the stored e-mail (the owner's `email_confirmed` flips to false at once, so their alerts stop until a new confirmation), replace the whole wishlist, or send a confirmation e-mail to any address (see SEC-4). No account, so the id is the only barrier. The id is a random v4 UUID from `gen_random_uuid()` (122 bits), so it cannot be guessed or enumerated; the risk is leakage only (see SEC-9).
Proof: logic read in the controller; the prefs call in SEC-9 shows the id alone authorises writes. I did not overwrite a real e-mail; the e-mail route sends mail, so I did not call it.
Fix: when an e-mail is already confirmed, keep it until the new address is confirmed (store the new one as pending). Rate-limit per watch id as well as per IP.        Verified fixed: not yet

### SEC-9  The personal calendar link contains the master watch id    Severity: medium    Status: open
Where: GET /drops/my.ics?watch=<id> (apps/api/src/drops/drops.controller.ts:73); link built in apps/web/src/components/drops/MyDrops.tsx:37        Found: 2026-10-22        Owner: Back end + Front end
What: The link is meant to be pasted into Google, Apple or Outlook calendar, so it is handed to third-party servers and appears in their settings, logs and any shared screenshot. The same id is the credential for the wishlist, alerts, e-mail binding and preferences. Anyone who sees the calendar link can therefore also change the owner's settings (SEC-10), and the path `/watch/<id>` appears in host logs and Sentry (SEC-7). A calendar feed should be read-only and revocable.
Proof: on localhost, created a test watch; `GET /drops/my.ics?watch=<id>` returned 200 text/calendar; `PATCH /watch/<id>/prefs {"instant":false}` with the same id returned 204 and `GET /watch/<id>` then showed `instant:false`. The calendar response sets no Cache-Control. An unknown id also returns 200 (empty feed), so the endpoint is not an oracle for valid ids.
Fix: add a separate random `calendar_token` per watch (read-only, regenerable) and use it in the feed URL; keep the watch id out of any shareable link. Add `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer` on the feed.        Verified fixed: not yet

### SEC-8  Newsletter reader trusts any SPF/DKIM pass, not one that matches the From address    Severity: medium    Status: open
Where: apps/api/src/scripts/fetch-email-news.ts (`authenticated()`, line 79; used at line 196)        Found: 2026-10-22        Owner: Drops and News desk
What: A mail is accepted if its Authentication-Results header contains `dkim=pass` or `spf=pass` for any domain. An attacker who owns a domain with valid SPF/DKIM can send mail with a forged From (a brand such as nike.com, or googlealerts-noreply@google.com) and it passes. Impact: made-up headlines on the public news page (fake "drops"), and for Google Alert mail, links to any https site shown as news. The attacker needs the address of the news mailbox. Output is limited: https links only, tags stripped, and React escapes text, so no script injection.
Proof: code read and a unit-level reading of the regex; I did not send mail (outward action). A duplicated Authentication-Results header makes mailparser return an array, which the code treats as failed, so that path fails closed.
Fix: accept only when the passing domain matches the From domain (`header.from=` / `header.d=` equals or is a subdomain of the sender's domain, or `dmarc=pass`); add a spec with a forged-From sample. Until then keep the email reader off (NEWS_IMAP_* unset).        Verified fixed: not yet

### SEC-7  Error reports and logs can carry personal data and the watch id    Severity: low    Status: open
Where: apps/api/src/instrument.ts (Sentry.init with no scrubbing), apps/api/src/email/email.service.ts:25,51 and waitlist.service.ts (e-mail addresses in log lines)        Found: 2026-10-21        Owner: Back end
What: The watch id (the only credential for wishlist, alerts and e-mail binding) sits in URL paths like `/watch/<id>/email`, and the API's Sentry setup has no `beforeSend` or URL/body scrubbing, so an error or a traced request (10% sampled) can ship that id, and request bodies containing e-mail addresses, to Sentry. Log lines also print recipient e-mail addresses. The web side is better: no replay, no tracing, and no server-only env var is read in any client component (checked all 'use client' files; the only NEXT_PUBLIC values are the API/WS URLs, Sentry DSN, PostHog key and host, which are meant to be public).
Proof: code read only; I did not send a test event to Sentry (that would leave our machine).
Fix: add a `beforeSend` that replaces UUIDs in `request.url` and strips `request.data`; log a masked address or the row id instead of the address.        Verified fixed: not yet

### SEC-6  Dependency advisories (npm audit, production deps): 2 critical, 9 high    Severity: medium    Status: open
Where: root lockfile; next 16.3.4, proxy-addr, multer, @nestjs/platform-express, sharp, nodemailer, @auth/core        Found: 2026-10-21        Owner: Back end / Front end
What: `npm audit --omit=dev` reports 16 (1 low, 4 moderate, 9 high, 2 critical). The two criticals: Next.js RCE in `next/og` ImageResponse (installed 16.3.4, fixed in 16.3.6+) and proxy-addr IP spoofing via IPv4-mapped IPv6 (fixed in 2.0.8). Rated medium, not critical, because grep finds no ImageResponse / next/og use in apps/web/src, so the Next RCE is not reachable today. The proxy-addr one matters more: the API sets `trust proxy` and the rate limiters key on `req.ip`.
Proof: npm audit output from the repo root, 2026-10-21; grep for ImageResponse in apps/web/src returned nothing.
Fix: upgrade next to a patched 16.3.x, proxy-addr >=2.0.8, sharp >=0.35.5, multer >=2.3.0 (via @nestjs/platform-express), file-type. One branch, tests run. Full triage with reachability, dev-tool noise and the new packages: office/security/dependency-triage.md.        Verified fixed: not yet

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
- Admin (2026-10-22): the web `/admin`, `/admin/drops`, `/admin/prices`, `/admin/moderation`, `/admin/catalog` return 404 for an anonymous visitor (page code calls `notFound()` unless the session role is admin and has an API token). The API rejects missing, garbage, `alg:none` and wrong-secret tokens with 401 on `/admin/drops`; `AdminGuard` re-reads the role from the database on every request, so removing admin takes effect at once. Not tested: a valid non-admin token (I will not read the signing secret), and admin pages with a real admin session.
- Security headers on the web app (dev server): CSP, X-Frame-Options DENY, nosniff, Referrer-Policy and Permissions-Policy all present. `unsafe-eval` in the CSP is dev-mode only per the config; check a production build before launch.
- CORS: a request with a foreign Origin got no allow header.
- Web: the only `dangerouslySetInnerHTML` is a constant CSS string in global-error.tsx.
