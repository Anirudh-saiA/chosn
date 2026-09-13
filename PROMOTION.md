# Promotion workflow

Day 27 replaces the direct-to-`main` pattern every earlier day used with
a staging tier. Starting now: **feature work lands on `develop` first,
gets verified on staging, then `develop` promotes to `main` for a real
production release.**

## Branches

- **`main`** — production. Deploys to the real Vercel/Railway production
  environment. Protected by a required-reviewer approval gate (see
  README's CI/CD section) — nothing reaches real users without a human
  clicking approve.
- **`develop`** — staging. Deploys automatically, no approval gate, to
  its own isolated Vercel preview URL and Railway staging environment
  (separate Postgres/Redis/API/worker from production — see below).
- **Feature branches** — cut from `develop`, merged back into `develop`
  via PR. `main` only ever receives commits by merging `develop` into
  it, never a feature branch directly.

## Day-to-day flow

1. Branch from `develop` for whatever the day's task is.
2. Open a PR into `develop`. CI runs lint/typecheck/test and a Vercel
   preview deploy on the PR itself (unchanged from before).
3. Merge into `develop`. This triggers `deploy-staging`
   (`.github/workflows/ci.yml`) — no approval needed, it's staging.
4. Verify the change on the staging URL against the staging database —
   this is where a real smoke test belongs, not against production.
5. When you're confident it's ready for real users, **promote**:
   `git checkout main && git merge develop && git push origin main`
   (or open a `develop` → `main` PR if you'd rather review the diff
   first — either way, this is the only path that ever touches `main`).
6. `deploy-production` runs, gated on the required-reviewer approval
   (same as today) before it actually goes live.

## What's isolated between the two tiers

| | Production (`main`) | Staging (`develop`) |
|---|---|---|
| Vercel deployment | Production alias, approval-gated | `chosn-web-git-develop-*.vercel.app`, auto-deploys |
| Railway Postgres | Production instance, real data | Separate staging instance, seeded independently |
| Railway Redis | Production instance | Separate staging instance |
| Railway API/worker | Production environment | Railway "staging" environment (same project, separate services — see README) |
| `NEXT_PUBLIC_API_URL` (Vercel) | Points at production Railway URL — set under Vercel's **Production** env-var scope | Points at staging Railway URL — set under Vercel's **Preview** env-var scope |
| `WEB_ORIGIN` (Railway) | Production Vercel URL(s) | Staging Vercel URL(s) — comma-separated if more than one (see `apps/api/src/common/cors-origins.ts`) |
| Sentry / PostHog | Same project as staging, tagged `environment: production` | Same project as production, tagged `environment: staging` — see `instrument.ts` / `analytics.ts` |
| Auth identity (`users`/`accounts`/`sessions`) | Production's Postgres | **Real, isolated** — `chosn_staging`, a second database on the *same* Railway Postgres server (Railway's Hobby-plan volume limit blocks a second Postgres *service*, but nothing stops a second logical database on the existing one). Verified: signing up on staging creates a row in `chosn_staging` only, confirmed absent from production. |
| Backend API/business logic (`apps/api`) | Production's Railway service | **Shared with production** — staging's frontend calls the *same* `chosnapi-production.up.railway.app`. A dedicated staging API/worker/Redis was attempted and blocked by Railway's account-level free-resource cap (not the volume limit — a harder, non-workaroundable-on-free-tier limit; upgrading is the only real fix). This means community/pricing/reputation data on staging is production's real data, not isolated — only auth identity is genuinely separate today. |
| Retailer API keys | Real production credentials | Sandbox/test credentials where the provider offers them; otherwise same fixture-mode behavior this app already has for an unconfigured retailer |
| Push notification (VAPID) keys | Real key pair — real subscribers get real pushes | Separate key pair, so staging testing never pushes to a real subscriber's device |
| Community content / test accounts | Kept clean — no test posts, no dummy accounts | Where messy test data belongs |

## Provisioning staging (one-time, dashboard work)

Not something this file's workflow re-does per day — set up once:

1. **Railway**: in the existing `chosn` project, add a new
   **Environment** named `staging` (Railway's Environments feature,
   *not* a second project) — see README's Railway section for the
   production setup this mirrors. Add its own Postgres and Redis
   services scoped to that environment (separate data from
   production), and deploy the API/worker services into it.
   **Check the volume limit first**: production's Redis deliberately
   runs as a plain `redis:7-alpine` Docker service instead of Railway's
   official Redis plugin, specifically because the Hobby plan allows
   only one persistent volume *per project* and Postgres already uses
   it — confirm whether that limit is per-project (would also block a
   second Postgres-with-volume in a new Environment) or per-Environment
   before assuming staging's Postgres/Redis can just use the official
   plugins.
2. **Railway variables**: copy every var from the production
   environment's Variables tab into staging's, then swap in
   staging-appropriate values per the table above (staging
   `DATABASE_URL`/`REDIS_URL` come from staging's own Postgres/Redis
   services' reference variables, not production's).
3. **Migrate + seed staging Postgres**: same migration files as
   production (`npm run db:migrate --workspace=@chosn/api` pointed at
   the staging `DATABASE_URL`), then seed the real launch catalog (safe
   to duplicate from production) plus test community content/accounts
   — production stays the one place that never gets test data.
4. **Vercel**: no new project needed — this repo's existing Vercel
   project already deploys any branch it's given via the CLI (see
   `deploy-staging` in `ci.yml`). Set `develop`-scoped variables under
   Vercel's **Preview** environment-variable scope (Project → Settings
   → Environment Variables → add for "Preview", not "Production"),
   pointing `NEXT_PUBLIC_API_URL` at the staging Railway URL from step 1.
5. **CORS**: set the staging environment's `WEB_ORIGIN` (Railway) to the
   staging Vercel URL. Production's `WEB_ORIGIN` stays as-is (its own
   value, not shared with staging).

None of this is something a CLI/CI job can do unattended — it needs
whoever owns the Railway/Vercel dashboards to actually click through it
once. Everything after that (deploys, CORS, monitoring tags) is
automatic per the table above.

## What's real today (Day 27, after actually trying this)

- ✅ `develop` branch, auto-deploying staging Vercel URL, no approval gate
- ✅ `chosn_staging` Postgres database — real, isolated, migrated,
  seeded with the real launch catalog, zero community/user content
- ✅ Staging auth genuinely works end to end and is genuinely isolated —
  verified with a real sign-up/sign-in against the staging URL, then
  confirmed the resulting user exists in `chosn_staging` and nowhere in
  production
- ✅ `trustHost: true` fix in `apps/web/src/auth.ts` — a real bug this
  setup found: Auth.js v5 refuses to operate on a branch deployment's
  dynamic URL without it
- ❌ Dedicated staging `apps/api`/Redis/worker — blocked by Railway's
  account-level free-resource cap, a harder limit than the volume one
  (that one had a free workaround; this one doesn't without upgrading)
- **Net result**: staging is real for identity/auth and frontend
  deployment verification, but shares production's actual backend and
  data for everything else (search, pricing, community, reputation).
  Treat a staging test of those as "does the frontend correctly call
  production," not "is this isolated from real users" — it isn't.
