# CHOSN

Sneaker price-intelligence and community platform. CHOSN compares external
retailer/reseller prices and routes users out — it never sells, processes
payments, or holds inventory.

This is the Day 3 infrastructure skeleton: repo, CI/CD, environments, and
the Day 2 design tokens wired into real components. No feature code yet.

**Staging:** https://chosn-web-gamma.vercel.app

- [Day 1 — Foundation Spec](docs/chosn-foundation-spec.html)
- [Day 2 — Design Tokens](docs/chosn-design-tokens.html)

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

**apps/web**

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Points at `apps/api` |
| `NEXT_PUBLIC_SENTRY_DSN` | no | Errors go nowhere until this is set |
| `NEXT_PUBLIC_POSTHOG_KEY` | no | Analytics no-op until this is set |
| `NEXT_PUBLIC_POSTHOG_HOST` | no | Defaults to PostHog Cloud (US) |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | no | Build-time only, for source-map upload |

**apps/api**

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://...` |
| `REDIS_URL` | yes | `redis://...` |
| `SENTRY_DSN` | no | Errors go nowhere until this is set |
| `WEB_ORIGIN` | yes | CORS allow-list |
| `PORT` | no | Defaults to 4000 |

No secret is ever committed — both `.env.example` files above hold
placeholders only.

## CI/CD

`.github/workflows/ci.yml`, on every PR: lint → typecheck → test → a
Vercel preview deploy. On merge to `main`: an automatic staging deploy,
then a production deploy gated on manual approval.

That approval gate is a **repo setting**, not something YAML alone can
express: in **Settings → Environments → production**, add at least one
required reviewer. Until that's set, `deploy-production` runs
unattended — the workflow file assumes the setting is on.

## Deployment checklist — this is the part that needs your accounts

Everything above is real, working code, verified to install and
typecheck (see below) — but this environment has no GitHub, Vercel,
Railway, Sentry, or PostHog credentials, so nothing has actually been
pushed or deployed. To get from here to a live staging URL:

1. `git init && git add -A && git commit -m "chosn: infra skeleton"`,
   push to a new GitHub repo.
2. **Vercel** → import the repo, set the project root to `apps/web`, add
   its env vars from the table above. Generate a token
   (`vercel.com/account/tokens`) and add `VERCEL_TOKEN`,
   `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` as GitHub Actions secrets.
3. **Railway** → new project from the same repo, root `apps/api`; add its
   Postgres and Redis plugins (this provisions the staging DB/cache —
   Railway wires `DATABASE_URL`/`REDIS_URL` in automatically). Railway's
   own GitHub integration auto-deploys `apps/api` on push to `main` —
   no Actions job needed for it.
4. **Sentry** → create a Next.js project and a Node project, drop each
   DSN into the matching env var.
5. **PostHog** → create a project, drop the key into
   `NEXT_PUBLIC_POSTHOG_KEY`.
6. Set the `production` environment's required reviewer in GitHub repo
   settings (see CI/CD above).
7. Push to `main` — staging deploys automatically; production waits for
   your approval in the Actions tab.

## Verified today

`npm install`, `npm run typecheck`, and `npm run lint` all pass against
this skeleton — see the session log for the exact run. No live URL exists
yet; that's step 1–3 above, not a code problem.
