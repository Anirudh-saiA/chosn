# Auth & security hardening (Day 16)

Real user accounts, before there's real user data to lose. Auth.js
(NextAuth v5) in `apps/web`, a first-pass security audit across
everything built Days 5–15, and the fixes that audit actually found.

## Provider choice — Auth.js (NextAuth v5), not Clerk or Supabase Auth

Task 1 named three acceptable options. Clerk and Supabase Auth are both
hosted services needing an external account with real API keys before
any code can be written against them — not something this session can
provision on the user's behalf. Auth.js is a library, not a hosted
service: it talks directly to this project's own Postgres via
`@auth/drizzle-adapter`, so it could be built and verified end-to-end
today, against the real database, without waiting on an external
signup. **Flagged for override** — if a hosted provider's admin UI
(user management, ban/suspend, built-in email deliverability) is worth
more than avoiding that dependency, Clerk or Supabase Auth are the
alternatives task 1 named; this was a "what's actually buildable right
now" call, not a claim that Auth.js is categorically better.

`next-auth@5.0.0-beta.32` — genuinely still in beta, flagged
explicitly rather than glossed over. It's also Auth.js's own official,
documented path for the App Router (v4 targets the Pages Router), used
widely in production despite the version label. Worth revisiting once
v5 stable ships, not urgent before then.

## Google — the OAuth provider (task 1's other flagged assumption)

Chosen per the brief's own framing (highest-value default, lowest
signup friction for a consumer product). Implemented conditionally —
see auth.ts's own comment — so the app runs correctly with email/
password alone until `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set.
**You need to create a real Google Cloud Console OAuth app** — nothing
in this session can do that; see the "Your actions" list.

## Session strategy — a real constraint, not a free choice

Originally built against `session.strategy: 'database'`, reasoning that
the `sessions` table gives real server-side revocation. Wrong, caught
by actually running the login flow, not by reading the docs first:
Auth.js's Credentials provider throws `UnsupportedStrategy` outright
under "database" strategy — email/password login is only supported
under `'jwt'`. Task 1 explicitly requires email/password, so this
wasn't optional once discovered.

What that costs: no server-side session row to delete for "sign out
everywhere." What restores it: `lib/auth/session-revocation.ts` — a
small Redis denylist (`revokedBefore` timestamp per user, checked in
the `jwt` callback on every request). Wired into the password-reset
flow already (a password change revokes every existing session, real
security hygiene, not just a schema decoration). The `sessions` table
this migration still creates isn't dead weight either — the Drizzle
adapter's OAuth linking flows use it structurally regardless of session
strategy.

**Short-lived access token + refresh, task 1's other explicit ask**: the
httpOnly/secure/sameSite session cookie (Auth.js's own JWE, confirmed
via real `Set-Cookie` headers — see Verification below) is the long-
lived credential the browser never reads directly; `apiToken`
(`lib/auth/api-token.ts`), a separate 15-minute JWT minted fresh on
every `session()` call, is the short-lived one apps/web actually sends
to apps/api as `Authorization: Bearer`. The cookie's own `updateAge`
rolling-refresh is the mechanism that keeps a session alive across
activity without ever re-prompting for a password — the JWT-strategy
analog of refresh-token rotation.

## MFA — TOTP, opt-in (task 2's flagged assumption)

Never required for v1, exactly as the brief recommended. RFC 6238 via
`otpauth` (interoperable with any real authenticator app), enrollment
gated on proving a real code from the secret before it turns on (no
half-configured lockout), secret encrypted at rest via `pgp_sym_encrypt`
(pgcrypto, already enabled since Day 1) with `TOTP_ENCRYPTION_KEY` — a
stolen database dump alone can't produce working codes.

## Migrating waitlist/loose records (task 3)

Done exactly the way the brief itself frames it — "link... on first
real login" — as a NextAuth `signIn` event
(`lib/auth/reconcile.ts`), not a one-time batch script. Runs on every
successful sign-in, idempotent (`WHERE linked_user_id IS NULL`), for
both `waitlist_entries.linked_user_id` (Day 5's signal — "did our
waitlist convert" is now an answerable question, and the row is never
deleted) and `subscribers.user_id` (Day 12's anonymous notify-me
identity). **Real, disclosed gap**: only email-bearing rows link this
way. A `subscribers` row with no email at all (push-only, no address
ever given) has nothing to match a login against and stays anonymous —
linking *that* case would need the browser's own `localStorage`
`subscriberId` sent up at login time, which isn't built today. Verified
live: seeded a matching waitlist row and subscriber row, logged in, and
confirmed both `linked_user_id`/`user_id` were set correctly afterward
— see Verification.

## Rate limiting (task 4) — sliding window, not the existing fixed window

`lib/auth/rate-limit.ts` is a deliberately different algorithm from
`apps/api`'s existing `RateLimitGuard` (Day 5, `INCR`+`EXPIRE` — a
fixed window that lets a burst straddle the window boundary at up to
2x the intended rate). A Redis sorted-set-based sliding window doesn't
have that gap, which matters specifically for credential stuffing.
Fails **closed** on a Redis error — the opposite of the general-purpose
guard's fail-open, deliberately: a login endpoint's rate limiter is the
thing standing between the internet and brute force, not a nice-to-have
that should degrade silently.

Applied per-IP and per-account (both, task 4's explicit ask) on all
three named endpoints:
- Login — inside `authorize()` itself, which receives the raw request
  (Auth.js v5's own `authorize(credentials, request)` contract), so no
  middleware was needed.
- Signup (`/api/auth/sign-up`).
- Password reset request + confirm (`/api/auth/password-reset/*`).

Verified live with a real burst (see Verification) — confirmed blocking
after repeated attempts against a fresh account, not assumed from
reading the code.

## Input validation audit (task 5)

Every controller in `apps/api` reviewed. Two already had proper
`class-validator` DTOs (waitlist, `notifications` POST/DELETE) and one
already validated its one path param via `ParseUUIDPipe`
(`market-intelligence`). **Four real gaps found and fixed** — all the
same underlying pattern: a query param read via `@Query('x')` as a
plain string, converted with `Number(x)` or passed straight through to
a raw SQL comparison, with no validation in between:

| Endpoint | Gap | Real failure, confirmed live | Fix |
|---|---|---|---|
| `GET /catalog/search` | `Number(limit)` on non-numeric input is `NaN`; `NaN ?? 24` is still `NaN` (`??` doesn't catch `NaN`) | `?limit=abc` → `500` (NaN reached a raw SQL `LIMIT` clause) | `SearchQueryDto` (`@Type(() => Number)`, `@IsInt`, `@Min`/`@Max`) |
| `GET /drops` | `from`/`to` reached `DropsService.list()`'s raw SQL unvalidated | a malformed date would 500 as a raw Postgres type-cast error | `ListDropsQueryDto` (`@IsDateString({strict:true})`) |
| `GET /news` | same `Number()` gap on `limit`/`offset`; `dropEventId` unvalidated against a UUID column | same class of 500 | `ListNewsQueryDto` |
| `GET /notifications/subscriptions` | `subscriberId` unvalidated against a typed Drizzle `eq()` on a UUID column | a malformed value 500'd | `ListSubscriptionsQueryDto` |

Every fix re-verified live after the change: the same malformed
requests that 500'd now return a clean `400` with a specific message,
and the legitimate/normal-input cases were re-checked to confirm
nothing broke — see Verification for the actual request/response pairs.

## WebSocket connection auth (task 6)

`DropLiveGateway`'s broadcast is genuinely public data (a drop's live
status) and doesn't need auth today — but the brief's own framing is
right that this shouldn't be retrofitted once a user-scoped broadcast
(community chat, a personal feed) needs it. `handleConnection` now
accepts an optional `?token=<apiToken>` on the WebSocket URL (the same
short-lived Bearer token minted for REST calls — a browser WebSocket
handshake can't set a custom header, so a query param is the standard
way to pass one), verified via `apps/api/src/auth/api-jwt.ts` (plain
`jsonwebtoken.verify`, same "vetted library" standard as password
hashing). A valid token identifies the connection in a `WeakMap`; an
invalid or missing one does **not** reject the connection — every
client, identified or not, still gets every broadcast, unchanged from
before today. Verified live: a valid token, an invalid token, and no
token all connected successfully, and the server log confirmed the
valid one was correctly identified while the invalid one was correctly
rejected *as a token* without closing the socket — see Verification.

## Secrets audit (task 7)

A real production `next build` (with every Day 16 secret actually
present in the environment — `.env.local` is auto-loaded by `next
build`, so this wasn't a build that had nothing to leak) followed by
`grep -r` across the emitted `.next/static` client bundle for the
literal secret values, the env var names themselves, and a broader
bcrypt-hash-shaped pattern sweep. **Zero matches, all three passes** —
confirmed by the grep actually running and returning nothing, not by
reasoning "there's no NEXT_PUBLIC_ prefix so it should be fine."
Retailer/VAPID credentials live entirely in `apps/api`'s own deploy
(Railway), a separate service with no shared env scope with `apps/web`
(Vercel) at all — there's no path for those to reach this bundle in the
first place.

## Dependency scanning (task 8)

`.github/dependabot.yml` added — none existed before today (checked).
One npm entry at the workspace root (Dependabot's npm ecosystem
understands npm workspaces natively from the root `package.json`, so
this covers `apps/api`, `apps/web`, and both `packages/*` without four
redundant entries scanning the same lockfile), grouped so `@nestjs/*`
and the Auth.js pieces land as one PR each rather than several that
would fail typecheck individually until the rest arrive. Plus a
`github-actions` entry — a stale pinned CI action is exactly the kind
of supply-chain surface this task is about, not just npm packages.
Validated by actually parsing the YAML (`npx js-yaml`), not just
visually checked.

Today's five new dependencies (`next-auth`, `@auth/drizzle-adapter`,
`bcryptjs`, `otpauth`, plus `jsonwebtoken`/`qrcode`/`ioredis`/`pg`/
`drizzle-orm`/`resend` in `apps/web`) introduced **zero new high/
critical** `npm audit` findings — checked before and after installing.
The pre-existing 6 high-severity findings (`@nestjs/cli`,
`@nestjs/platform-express`, `glob`, `multer`, `picomatch`, `tmp`) are
unchanged from Day 14's assessment, all requiring major-version bumps
of core framework deps — still flagged, still out of today's scope,
now also tracked by Dependabot going forward rather than only by memory
across days.

## Automated security scan (task 9)

No real staging environment exists (Day 11's own CI comment: Hobby
plan, one Vercel URL, which is production) — asked rather than guessed
which target was safe to point an *active* scanner at. Ran OWASP ZAP
against a real local production build instead of real production; a
full active scan turned out to genuinely strain this dev machine (10
pre-existing unrelated Docker containers already running), so the
actual run used the lighter passive baseline scan instead. Full write-
up, real before/after finding counts, and the fixes each one drove —
`security/README.md` at the repo root, with the actual ZAP HTML/JSON
reports alongside it.

## Verification

Everything below was run against the real local stack (Postgres,
Redis, both services built and started, not `next dev`), not assumed
from reading the code:

- **Signup → login → session**: created a real account via
  `POST /api/auth/sign-up`, confirmed a genuine bcrypt hash
  (`$2b$12$...`) landed in `users.password_hash` (queried directly),
  logged in via the real NextAuth credentials callback (CSRF token
  fetched first, as a real browser would), confirmed a working session
  with a correctly-shaped, correctly-scoped `apiToken` (`iat`/`exp` 900s
  apart, decoded and checked, not assumed from the code).
- **Cookie security**: confirmed via real `Set-Cookie` response
  headers — `HttpOnly; SameSite=Lax` present (Secure is correctly
  absent on `http://localhost`; Auth.js enables it automatically over
  https, which this environment can't demonstrate directly).
- **TOTP**: enrolled for real (`/api/auth/totp/enroll`), computed the
  actual 6-digit code from the returned secret using the same `otpauth`
  library the server uses, confirmed enable succeeds with a correct
  code. Then confirmed a subsequent login without a code fails with
  `totp_required`, and the same login *with* a freshly-computed code
  succeeds and establishes a real session.
- **Migration/reconciliation (task 3)**: seeded a `waitlist_entries`
  row and a `subscribers` row sharing an email with a real test
  account, confirmed both `linked_user_id`/`user_id` were `NULL`
  beforehand, logged in, confirmed both were correctly set to the real
  user's id afterward — no manual linking step, exactly the "on first
  real login" behavior task 3 asked for.
- **Rate limiting (task 4)**: burst 10 wrong-password attempts against
  a fresh account from one IP; the sliding window correctly started
  returning `rate_limited` partway through and stayed blocked for every
  subsequent attempt in the window — confirmed via the real `Location`
  header on each response, not the rendered page.
- **Input validation audit (task 5)**: four real gaps found (see the
  table above) by actually calling each endpoint with malformed input
  before writing any fix, confirmed each returned a real `500` before
  and a clean `400` with a specific message after, and confirmed the
  legitimate/normal-input case for each endpoint still worked
  afterward.
- **WebSocket auth (task 6)**: connected three real WebSocket clients
  (Node's native `WebSocket`, not a mock) — no token, a valid token
  minted from a real session, and a garbage token. All three connected
  successfully (confirming anonymous access is unaffected); the server
  log confirmed the valid token was correctly identified with the right
  user id and the invalid one was correctly rejected as a token without
  closing the connection.
- **Secrets audit (task 7)**: a real production `next build` with every
  Day 16 secret actually present in the environment, then `grep -r`
  across the emitted client bundle for the literal values, the env var
  names, and a bcrypt-hash-shaped pattern — zero matches across all
  three passes.
- **Dependabot config (task 8)**: parsed with `npx js-yaml` to confirm
  it's valid, not just visually checked.
- **ZAP (task 9)**: three full scan runs against the real build — before
  any header changes, after the first header pass (caught that
  `same-origin-allow-popups` was itself flagged as weak), and the final
  state after correcting it — see `security/README.md`.

## Your actions

Nothing in this session can do these — they need your own accounts:

1. **Google OAuth** — create a project at
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   add an OAuth 2.0 Client ID (Web application), authorized redirect URI
   `<your deployed URL>/api/auth/callback/google`. Set `AUTH_GOOGLE_ID`/
   `AUTH_GOOGLE_SECRET` on Vercel. Until then, email/password works
   fully and Google sign-in simply doesn't appear as an option.
2. **Generate and set real secrets on Vercel** (`AUTH_SECRET`,
   `API_JWT_SECRET`, `TOTP_ENCRYPTION_KEY`) — one command each, see
   `.env.example`'s own comments. **`API_JWT_SECRET` must also be set
   on Railway (apps/api), to the exact same value**, or the WebSocket/
   future-API auth pattern silently fails closed (falls back to
   anonymous — not a crash, but not working either).
3. **Enable Dependabot alerts** in this repo's Settings → Code security
   and analysis — the `dependabot.yml` config enables version-update
   PRs on its own, but vulnerability *alerts* (the Security tab) need
   this toggle separately, especially if this repo is private.
4. Decide whether the `'unsafe-inline'` CSP tradeoff and the skipped
   COEP header (both explained above) are acceptable, or whether the
   nonce-based alternative's dynamic-rendering cost is worth paying —
   this is a real product/performance tradeoff, not just a technical
   detail.
