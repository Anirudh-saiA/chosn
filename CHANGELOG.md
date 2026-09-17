# Changelog

A dated record of decisions and root causes that aren't obvious from
commit messages alone — started Day 36, backfilled for everything since
Day 26 that's genuinely worth knowing three months from now without
re-deriving it from git history or conversation logs. Not a full commit
log (see `git log` for that) — this is "why," not "what changed."

## Day 36 — Legit Check formalized as a feature flag; docs reconciled

`FEATURE_LEGIT_CHECK_ENABLED` (`apps/web/src/lib/feature-flags.ts`)
replaces the Day 35 hardcoded omission — one named flag, one file, every
consumer reads the same source of truth. README rewritten to stop
describing this repo as a "Day 3 skeleton, no feature code yet" (badly
stale) and to actually list what's live vs. deferred. `.env.example`
(both apps) reconciled against README's tables; the `STORAGE_*` comment
in `apps/api/.env.example` corrected — it still described the
pre-Day-30 crash-at-boot behavior. Added `docs/health-checks.md`,
writing down what `/health` and `/health/fetch` actually mean after
days of using them for real verification with the knowledge living only
in conversation history.

## Day 35 — Legit Check hidden from post creation

Product decision, not a bug: Legit Check needs real object storage to
accept a photo (see Day 26 below), and that storage was never actually
set up in any real environment. Rather than let a user start a flow
that can't finish, it was removed from the community composer's
selectable post types. Backend untouched — the post type, its
endpoints, and the entire Day 26 upload/classifier/EXIF pipeline still
work correctly for any Legit Check post that already exists; only the
creation entry point is hidden.

## Day 33 — Sentry and PostHog actually went live

Both had been "configured, not verified" or fully unconfigured for
weeks. `chosn-api`'s Sentry turned out to already be live and receiving
real errors (discovered mid-session, not something this project set up
that day) — including real evidence of the Day 26→30 storage outage
(an `EADDRINUSE` crash-loop error) and the Superkicks/VegNonVeg mapping
bug (see Day 32), both independently confirming root causes already
diagnosed by other means. `chosn-web`'s Sentry had been **deliberately
removed** months earlier (it cost ~111KB per page load while reporting
nowhere, since no DSN had ever been set) — reinstalled from scratch
once a real DSN existed, verified with an actual flushed test event
before merging. PostHog: real project, key wired in, confirmed
capturing real pageview events with correct URLs.

## Day 32 — Superkicks/VegNonVeg's 2-variant fetch failure, root-caused

Not a fetcher bug. Traced to Day 20's own delisting migration: verified
against the live sites that Superkicks no longer stocks the exact
adidas Samba OG colorway (`B75806`) and VegNonVeg no longer stocks the
exact New Balance 550 colorway (`BB550WT1`) mapped at launch, and
correctly deleted the resulting fictional `manual_price_entries` rows —
but left the `retailer_product_mappings` row itself in place, so every
weekly cycle since kept trying to price a listing that no longer
exists, permanently failing both sizes on each retailer. Fixed by
removing the two orphaned mapping rows (migration
`0017_remove_orphaned_manual_mappings.sql`). Neither sneaker lost
coverage — both kept Ajio/END./Flipkart/Myntra.

## Day 31 — `deployedCommit` added to `/health`

Direct response to Day 30: `/health` could prove the API responds, but
never which commit was actually running — exactly the gap that let a
real outage hide for days (see Day 30 below and `docs/health-checks.md`
for the full story). Reads Railway's auto-injected
`RAILWAY_GIT_COMMIT_SHA`.

## Day 30 — Root-caused and fixed a multi-day production outage

`StorageService` (Day 26) threw an error at construction when
`STORAGE_*` env vars were unset. Production never got real R2/S3
credentials, and NestJS eagerly instantiates every provider in its
module graph at boot — so from the moment Day 26 merged to `main`,
every deploy crash-looped, failed Railway's healthcheck, and got
silently rolled back to the last build that *did* boot. Migrations run
before that crash point, though, so the database kept advancing (Day
27-29's schema/data changes all landed) while the code actually serving
traffic stayed frozen days behind — explaining exactly why new
endpoints 404'd while the database looked current. Diagnosed by reading
Railway's actual deployment logs, not assumed. Fixed the way every
other optional integration in this codebase already works: missing
config disables just that one feature (a clear 503), never crashes the
whole app.

## Day 26 — Object storage built, never actually deployed with real credentials

`community/storage.service.ts`: a generic S3-compatible client (works
against Cloudflare R2 or AWS S3 unchanged). Code-complete and correct
from day one — magic-byte file validation, EXIF stripping, a fail-closed
NSFW classifier gate. What never happened: an actual bucket with real
credentials in any environment. `docs/community/README.md` originally
labeled this section "resolved," which was only true of the code —
corrected Day 36. This gap is the direct reason both the Day 30 outage
happened and Day 35 hid Legit Check from creation.
