# CHOSN

Sneaker price-intelligence and community platform. CHOSN compares external
retailer/reseller prices and routes users out — it never sells, processes
payments, or holds inventory.

**Production:** https://chosn-web-gamma.vercel.app
**Production API:** https://chosnapi-production.up.railway.app ([/health](https://chosnapi-production.up.railway.app/health))
**Staging:** URL pending — see `PROMOTION.md` (Day 27 introduced a real staging tier; the line above used to be mislabeled "Staging" from back when this repo had only one environment)

- [Day 1 — Foundation Spec](docs/chosn-foundation-spec.html)
- [Day 2 — Design Tokens](docs/chosn-design-tokens.html)
- [docs/health-checks.md](docs/health-checks.md) — `/health` and `/health/fetch`, and how they're actually used for deploy verification
- [CHANGELOG.md](CHANGELOG.md) — dated decision log for anything not obvious from a commit message alone

## What's live (Day 36)

- **Price comparison** — a 28-model catalog (see `apps/api/src/retailers/README.md`) mapped across up to 6 retailers, real Market Intelligence signals (current/best/avg30/avg90/trend), auto-refreshed on real fetch cycles
- **Drops & news** — calendar, live-status WebSocket broadcast, web push (once VAPID keys are set), auto-posted news from drop events
- **Community** — Price Check, Cop or Drop, and Drop Talk posts, live per-drop chat, reputation scoring, unified search, moderation/trust & safety infrastructure (reporting, blocking, anonymity)
- **Auth** — Auth.js v5 (email/password + Google OAuth), TOTP 2FA, rate limiting, session revocation
- **Monitoring** — real Sentry (`chosn-api` + `chosn-web`, separate projects) and PostHog, both confirmed capturing real events as of Day 33

## What's explicitly deferred

- **Legit Check** (community post type: per-post photo checklist, verified via a NSFW classifier) — fully built (Day 26) but **hidden from post creation** as of Day 35/36 behind `NEXT_PUBLIC_FEATURE_LEGIT_CHECK_ENABLED` (default off — see `apps/web/src/lib/feature-flags.ts`). Blocked on setting up real Cloudflare R2 object storage credentials, a deliberately deferred product decision, not a bug. See `docs/community/README.md` for the full technical writeup and `CHANGELOG.md` for the decision history.
- **Real retailer credentials** — 4 of 6 retailer sources (Flipkart, Myntra, Ajio, END.) still run on fixture data; the affiliate programs were never actually joined (a partnership step, not a code one)
- **Sentry alert rules / PostHog dashboards** — both platforms are live and receiving real events, but alerting and dashboard scaffolding haven't been configured yet

## Repo structure

Turborepo, npm workspaces.

```
apps/
  web/            Next.js (TypeScript, App Router) — the product frontend
  api/             NestJS — the backend
packages/
  ui/              Shared React components, styled from tokens only
  config/          Shared Tailwind preset + TypeScript base configs
```

**Why a monorepo:** one team, one deploy cadence, and the frontend/backend
share zero code today except design tokens and types — but they will, once
Phase 2 needs a typed API contract between them. A monorepo means that
sharing costs a workspace import, not a private-package publish step. For
1–3 people, the coordination overhead of separate repos (version pinning,
cross-repo PRs for a single change) outweighs anything a monorepo costs.

## Assumptions made today — override any of these

1. **npm workspaces, not pnpm.** Turborepo is usually paired with pnpm;
   this environment only had npm preinstalled, and npm workspaces avoid
   asking a 1–3 person team to install and learn a second package manager
   for no functional gain at this scale.
2. **A `/design-system` route instead of Storybook.** Storybook is real
   value at team-scale; today it's a second build pipeline to maintain for
   five components. The route in `apps/web/src/app/design-system` gives
   the same visual QA for the cost of one Next.js page.
3. **Railway over Render/AWS for the API.** Simplest path to a Postgres +
   Redis instance and a deploy, with a native GitHub integration — no
   Actions scripting needed for the API specifically (see Deployment
   below).
4. **Vercel env vars + Railway env vars, no Doppler.** Both platforms
   already separate variables per environment and neither commits secrets
   to the repo, which is the actual requirement. Doppler is a third
   account to manage for a team this size; revisit if the team grows or
   secrets need to be shared with services outside Vercel/Railway.
5. **Primary button uses Brass, not Signal.** The Day 2 sample-copy block
   put Signal green on the primary CTA — decorative use, which Day 2's
   own principle 04 rules out. Fixed in `packages/ui/src/Button.tsx`, with
   the reasoning in the comment there.

## Design tokens → code

- `packages/config/tailwind-preset.js` — the Day 2 palette, type scale,
  and the zero-radius/no-shadow rule, translated 1:1. `borderRadius` and
  `boxShadow` are *replaced*, not extended, so `rounded-lg` or `shadow-md`
  don't quietly exist as an escape hatch.
- `apps/web/src/app/globals.css` — the one thing Tailwind can't express:
  the ticker's keyframes, its easing curve, and its
  `prefers-reduced-motion` fallback, straight out of Day 2 §05.
- `apps/web/src/app/layout.tsx` — loads Zilla Slab, Archivo, and JetBrains
  Mono via `next/font/google`, which self-hosts the actual font files at
  build time. That was Day 2's deliberate choice, not a generic default,
  so no self-hosted `@font-face` override was needed on top of it.

## Local development

Prerequisites: Node 22, Docker (for Postgres/Redis).

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

docker compose up -d      # Postgres on :55432, Redis on :6380
npm install
npm run dev                # runs web (:3000) and api (:4000) together
```

Visit `localhost:3000` for the placeholder home page, or
`localhost:3000/design-system` for every component variant. Visit
`localhost:4000/health` to confirm the API can reach Postgres and Redis.

## Environment variables

Full detail and setup instructions live as comments in each
`.env.example` — this table is a reconciled index (Day 36), not a
duplicate. No secret is ever committed; both files hold placeholders
only.

**apps/web**

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Points at `apps/api` |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | no | **Live as of Day 33** — real project, confirmed capturing real events. No-op if unset. |
| `NEXT_PUBLIC_SENTRY_DSN` | no | **Live as of Day 33** — `chosn-web` project, confirmed working via a real flushed test event. No-op if unset. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | no | Build-time only, source-map upload. Error reporting itself works without these — just minified stack traces. |
| `NEXT_PUBLIC_FEATURE_LEGIT_CHECK_ENABLED` | no | **Day 36.** Off by default — see "What's explicitly deferred" above. |
| `NEXT_PUBLIC_WS_URL` | no | Override for the WebSocket base URL; derived from `NEXT_PUBLIC_API_URL` if unset |
| `DATABASE_URL` / `REDIS_URL` | yes | Auth.js's adapter + rate limiting — same instances `apps/api` uses |
| `AUTH_SECRET` / `AUTH_URL` | yes / no | NextAuth's cookie key; `AUTH_URL` only needed where the deployed URL can't be inferred |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | Google sign-in; email/password works without these |
| `API_JWT_SECRET` | yes | Must match `apps/api`'s value exactly |
| `TOTP_ENCRYPTION_KEY` | yes | 2FA secret-at-rest encryption |
| `RESEND_API_KEY` / `RESEND_FROM` | no | Password reset emails; logs the link instead of sending until set |

**apps/api**

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` / `REDIS_URL` | yes | `postgresql://...` / `redis://...` |
| `WEB_ORIGIN` | yes | CORS allow-list, comma-separated (Day 27) — production and staging both at once |
| `PORT` | no | Defaults to 4000 |
| `PG_POOL_MAX` | no | Defaults to 20 |
| `SENTRY_DSN` | no | **Live as of before Day 33** — `chosn-api` project, confirmed receiving real errors. No-op if unset. |
| `RESEND_API_KEY` / `RESEND_FROM` | no | Waitlist confirmation email |
| `FLIPKART_AFFILIATE_ID` / `_TOKEN` | no | Fixture mode until set — affiliate programme not yet joined |
| `ADMITAD_ACCESS_TOKEN` / `_WEBSITE_ID` | no | Myntra — fixture mode until set |
| `INRDEALS_API_TOKEN` / `_PUBLISHER_ID` | no | Ajio — fixture mode until set |
| `AWIN_API_TOKEN` / `_PUBLISHER_ID` | no | END. Clothing — fixture mode until set |
| `PRICE_FETCH_SCHEDULE` / `MARKET_INTELLIGENCE_SCHEDULE` / `DROP_SCHEDULER_SCHEDULE` | no | Set to `off` to disable that scheduler |
| `FETCH_HEALTH_LOG` | no | Set to `off` to silence the hourly pipeline health summary |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | no | Web push; no-op until set |
| `API_JWT_SECRET` | yes | Must match `apps/web`'s value exactly |
| `STORAGE_BUCKET` / `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` / `STORAGE_REGION` / `STORAGE_PUBLIC_BASE_URL` | no | Cloudflare R2/S3 for Legit Check photos — **not yet set anywhere** (see "What's explicitly deferred"); missing config disables just that feature (Day 30 fix), doesn't crash the API |
| `PERSPECTIVE_API_KEY` | no | NSFW/toxicity classifier; every caller treats an unset key as "unavailable," not an error |

## CI/CD

**Branch strategy (Day 27) — see `PROMOTION.md` for the full workflow:**
`develop` is staging, `main` is production. Feature branches merge into
`develop` first; `develop` only ever reaches `main` via an explicit
promotion, never a direct push.

`.github/workflows/ci.yml`, on every PR: lint → typecheck → test → a
Vercel preview deploy. On merge to `develop`: an automatic staging
deploy, no approval needed. On merge to `main`: a production deploy
gated on manual approval.

Deploys use Vercel's own CLI (`npm install -g vercel@latest`), not the
`amondnet/vercel-action` marketplace action — that action pins a
years-old Vercel CLI version that no longer talks to Vercel's current
API correctly (`Error! Could not retrieve Project Settings`, even with
correct credentials). Installing the CLI fresh each run keeps it
current for free.

Staging deploys to a Vercel-assigned git-branch-alias URL
(`chosn-web-git-develop-*.vercel.app`), not a custom subdomain — no
second Vercel project or domain purchase needed, the CLI gets this for
free from git metadata `actions/checkout@v7` already provides. An
earlier version of this doc assumed a `staging.chosn.app` domain would
be added later; that's still a fine upgrade (a `vercel alias set` step)
but isn't required for staging to work.

The approval gate on production is a **repo setting**, not something
YAML alone can express: in **Settings → Environments → production**,
add at least one required reviewer. Until that's set,
`deploy-production` runs unattended — the workflow file assumes the
setting is on.

**Also turn off Vercel's own automatic Git deployments** (Project →
Settings → Git) if you haven't — otherwise Vercel deploys straight to
production on every push to `main` on its own, bypassing this approval
gate entirely.

## Deployment status

Repo is on GitHub (public — required for GitHub's free-tier Environment
approval gate to work at all), frontend on Vercel, backend + Postgres +
Redis on Railway, all wired together and verified live.

**Staging (Day 27):** a separate Railway "staging" Environment plus a
`develop`-branch Vercel deploy is documented as the plan in
`PROMOTION.md`, not yet provisioned as of this doc update — that's
dashboard work for whoever owns Railway/Vercel access, not something a
CI job or this session's tools can do unattended. One real risk worth
checking before assuming it'll "just work": the Hobby-plan **one-volume-
per-project** limit noted below for Redis may also apply across
Environments, not just within production — if so, staging Postgres
needs the same real-volume budgeting decision production's Redis
already made (a plain Docker image instead of the official plugin, or
sharing production's one volume isn't an option since that defeats the
point of isolated data). Confirm Railway's actual per-Environment volume
quota before assuming a second Postgres-with-volume just works.

**Railway specifics, since a few things didn't work on the first try:**
- The `apps/api` service builds from the **repo root** with
  `npm run build --workspace=@chosn/api` / `npm run start --workspace=@chosn/api`
  as its build/start commands (Root Directory left unset) — Railway's
  Nixpacks detected this correctly on its own for an npm-workspaces repo.
- **Redis is a plain `redis:7-alpine` Docker image service, not
  Railway's official Redis plugin.** The plugin auto-attaches a
  persistent volume on creation, and the Hobby plan allows only one
  volume per project — Postgres already uses it. A cache doesn't need
  durability, so a volume-free Docker deploy sidesteps the limit
  entirely. `REDIS_URL` is set by hand to
  `redis://redis.railway.internal:6379` (Railway's private-networking
  DNS convention: `<service-name>.railway.internal`) rather than
  referenced from a plugin variable, since a plain Docker service
  doesn't publish one.
- `DATABASE_URL` *is* referenced from the Postgres plugin's own
  variable (the reference-picker in the Variables tab), which stays in
  sync automatically if it ever changes.
- Both Postgres and the api service scale to zero when idle on the free
  plan ("Sleeping") and wake on the next request — a `/health` hit
  right after a period of inactivity can read `"error"` on its first
  try purely from the cold-start race, not a real failure. Retrying a
  few seconds later is the correct response, not a fix.

**Vercel specifics:**
- Deploys use `vercel pull` / `vercel build` / `vercel deploy --prebuilt`
  run from the **repo root**, not `apps/web` — `chosn-web`'s Root
  Directory is configured as `apps/web` on Vercel's side, and the CLI
  applies that itself; `cd`-ing into `apps/web` first doubles the path.
- `NEXT_PUBLIC_API_URL` on Vercel points at the Railway URL above, not
  `localhost`.
- Sentry and PostHog are both real and confirmed working as of Day 33
  — see "What's live" above. Sentry is two separate projects,
  `chosn-api` (backend) and `chosn-web` (frontend, reinstalled that
  same day after an earlier deliberate removal — see
  `apps/web/next.config.mjs`'s own comment on that history). Neither
  has alert rules or dashboards configured yet (Day 34) — receiving
  events isn't the same as being actionable, and that's still open.

## Verified

`npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, and
a real `next build` all pass locally. CI (`.github/workflows/ci.yml`)
runs the same checks plus a Vercel preview deploy on every PR, and a
production deploy gated on manual approval (GitHub Environment
"Production," required reviewers on) on merge to `main`. The API's
`/health` endpoint reports both Postgres and Redis reachable from the
live Railway deployment.
