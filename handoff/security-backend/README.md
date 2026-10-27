# Security -> Back end: approved fixes (founder approved 2026-10-27)

Seven patches, each written against develop 6629550 + merge, each tested in a scratch copy and then reverted: nothing here is applied. Apply on your own branch, run the checks, hand to Main to merge. Nobody pushes without the founder's "push".

Apply one at a time from the repo root: `git apply --check handoff/security-backend/<file>.patch` then `git apply <file>.patch`. (If git complains about line endings, add `--ignore-whitespace`.) Files in the working copy use Windows line endings; the patches already match them.

| Order | Patch | Finding | What it does | Tests it adds |
|---|---|---|---|---|
| 1 | `SEC-1-identify.patch` | SEC-1 (high) | `identify()` never returns an existing subscriber's id for a typed e-mail; a known address gets a fresh anonymous row | `notifications.identify.spec.ts` (2 tests) |
| 2 | `SEC-12-compose-loopback.patch` | SEC-12 (high) | Postgres and Redis published on `127.0.0.1` only | none (`docker compose config` checked) |
| 3 | `SEC-14-rate-limit-key.patch` | SEC-14 (medium) | Limiter keys on `req.ip` (not the client's `X-Forwarded-For`) and on controller + handler name | `rate-limit.guard.spec.ts` (2 tests) |
| 4 | `SEC-13-websocket-caps.patch` | SEC-13 (medium) | `maxPayload` 16 KB on chat and 1 KB on drops; room ids must be UUIDs; 20 rooms per socket; empty rooms removed | `chat.gateway.limits.spec.ts` (3 tests) |
| 5 | `SEC-6-replace-file-type.patch` | SEC-6 | Replaces the `file-type` package on the upload path with a three-signature check (JPEG, PNG, WebP). The API really runs file-type 16.5.4; the audit's fix is a major jump to an ESM-only 22.x, so removing it is smaller and safer | `sniffImage` tests added to `post-images.service.spec.ts`; the old mock is gone |
| 6 | `SEC-11-untrack-pyc.patch` | SEC-11 | Stops tracking the four `.pyc` files and ignores `__pycache__/` and `*.pyc` | none |

Patch 6 touches the shared `.gitignore` and `scripts/`; it is Main's to apply, kept here for convenience.

Checked after each patch, in a scratch copy of this branch: `tsc --noEmit` clean, `eslint --max-warnings=0` clean on the touched folders, the touched vitest files pass. Whole-suite run before the changes: 105 tests pass. Not run: the live API with these patches (starting it would run migrations and the schedulers on the local database), and a browser.

## Do these yourself after applying
- After patch 5: `npm uninstall file-type -w apps/api` so `package.json` and the lockfile drop it (I did not touch them: the worktree shares `node_modules` with the main checkout).
- After patch 2: `docker compose up -d` recreates the containers on loopback. To go further, change `POSTGRES_PASSWORD` and add `--requirepass` to Redis, then update `DATABASE_URL` and `REDIS_URL` in the `.env` files (founder holds those). Also bind the dev servers to `127.0.0.1` on public Wi-Fi.
- Patch 4 does not add a per-IP connection cap (needs the proxy-aware address); add one if the chat gets public traffic.
- Patch 3 restarts every rate-limit counter (new key names). Harmless.

## Dependency upgrades (one branch, Back end + Front end, not a patch)
`package-lock.json` cannot be regenerated safely from Security's copy, so this is a plan. Audit today (`npm audit --omit=dev`): 18 (4 critical, 10 high, 4 moderate).

1. `proxy-addr`: Express 5.2.1 only needs 2.0.8 or newer, so run `npm update proxy-addr` (latest is 2.0.8) and check `npm ls proxy-addr` shows one version.
2. `npm i @nestjs/platform-express@^12.2.0 -w apps/api` (latest is 12.2.0; check `npm ls multer` afterwards: the audit flags multer up to 2.4.0, latest is 2.5.0).
3. `npm i next@^16.4.3 -w apps/web` (latest 16.4.3; audit range for the open advisories ends at 16.4.0) and `npm i @sentry/nextjs@^11.9.0 -w apps/web` (audit range ends at 10.75.1; it is a major bump, read the Sentry migration notes; the tunnel-route bug does not apply to us because we have no `tunnelRoute`).
4. `npm i sharp@^0.35.5 -w apps/api` (librsvg fix; SVG never reaches sharp here, so low urgency).
5. `nodemailer` and `@auth/core` / `next-auth`: no fixed version exists in the audit yet; leave, and check we never pass user-controlled `raw` content to `sendMail`.
6. Dev tools (vite, vitest, esbuild, tailwindcss chain): do not follow `npm audit fix --force`; it proposes old or major versions. Upgrade on a branch with the suite.
7. Then run, from the root: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm audit --omit=dev` again. Security will re-count and mark SEC-6 verified.

After each fix lands, Security re-runs the original proof and marks the finding verified in `office/security/findings.md`.
