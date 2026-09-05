# CHOSN

Sneaker price-intelligence and community platform. CHOSN compares external
retailer/reseller prices and routes users out — it never sells, processes
payments, or holds inventory.

This is the Day 3 infrastructure skeleton: repo, CI/CD, environments, and
the Day 2 design tokens wired into real components. No feature code yet.

**Staging:** https://chosn-web-gamma.vercel.app
**API:** https://chosnapi-production.up.railway.app ([/health](https://chosnapi-production.up.railway.app/health))

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
Vercel preview deploy. On merge to `main`: a production deploy gated on
manual approval.

Deploys use Vercel's own CLI (`npm install -g vercel@latest`), not the
`amondnet/vercel-action` marketplace action — that action pins a
years-old Vercel CLI version that no longer talks to Vercel's current
API correctly (`Error! Could not retrieve Project Settings`, even with
correct credentials). Installing the CLI fresh each run keeps it
current for free.

There's no separate staging domain today — Hobby plan, one Vercel
project, one real URL. If a real staging subdomain gets added later,
that's a `vercel alias set` step in `deploy-production`, not a whole
second environment tier.

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
- Sentry and PostHog are still genuinely unconfigured (no DSN/key set
  anywhere) — the no-op guards mean nothing breaks, they just don't
  report anything yet. Setting them up is a "when needed," not a
  blocker.

## Verified

`npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, and
a real `next build` all pass locally. CI (`.github/workflows/ci.yml`)
runs the same checks plus a Vercel preview deploy on every PR, and a
production deploy gated on manual approval (GitHub Environment
"Production," required reviewers on) on merge to `main`. The API's
`/health` endpoint reports both Postgres and Redis reachable from the
live Railway deployment.
