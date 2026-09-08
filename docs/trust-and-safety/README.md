# Trust & safety foundation (Day 17)

Built ahead of full community features (chat/forum come in a later
phase) specifically so the safety layer isn't retrofitted after
user-to-user interaction already exists. This document is the map of
what shipped, the two assumptions flagged for override, the anonymity
audit's actual findings, and the blocking enforcement contract task 2
asked to have documented.

## What shipped

- **Reporting** (task 1): `reports` table + `POST /trust-safety/reports`
  (any authenticated user), `GET`/`PATCH /trust-safety/reports` (admin
  only) — see `apps/api/src/trust-safety/`. `0009_trust_safety.sql` and
  `db/schema.ts` carry the full field-level reasoning.
- **Blocking** (task 2): `user_blocks` table + `POST/DELETE/GET
  /trust-safety/blocks` — see the enforcement contract below.
- **Anonymity controls** (task 3): `display_name` + `avatar_seed`
  columns, a locally-generated identicon (`apps/web/src/lib/avatar.ts`,
  `components/AvatarIdenticon.tsx` — no photo upload, no third-party
  image CDN), both editable at `/account/security`.
- **DM safety policy** (task 4): `docs/trust-and-safety/dm-safety-policy.md`
  — a binding spec, no DM feature exists yet to implement it against.
- **Moderation admin view** (task 5): `/admin/moderation`, gated on
  `role = 'admin'`.
- **Classifier scaffolding** (task 6): `apps/api/src/moderation/classifier.service.ts`
  — `classifyText` wired to a real API (Perspective); `classifyImage` is
  a deliberate stub, see "Assumption 2" below.
- **Community Guidelines** (task 7): `/community-guidelines` — real,
  published copy covering harassment, hate speech, doxxing, and
  scam/legit-check abuse.
- **Transparency commitment** (task 8): `/transparency` — the
  quarterly-reporting commitment, honestly marked as having no report
  history yet to summarize.

## Assumptions flagged for override

### 1. Admin role: a single `role` enum column on `users`, not a separate roles/permissions table

`users.role` is `'user' | 'admin'` (see `0009_trust_safety.sql`'s own
comment for the `role`-vs-`is_admin` reasoning — extensibility toward a
future `'moderator'` tier cost nothing to leave room for). This is the
simplest thing that satisfies task 5's requirement literally
("auth-gated to an admin role — add an `is_admin` or `role` field to
User if not present"). It does **not** give you: per-permission grants,
audit logging of who changed whose role (today that's a manual
`UPDATE users SET role = 'admin' WHERE email = ...` — deliberately not
exposed through any API, since Day 17 shipped no self-service path to
grant admin), or more than two tiers. If CHOSN's moderation needs ever
grow past "admin can do everything, everyone else can do nothing
moderation-related," this is the piece to revisit first — a proper
roles/permissions table, not a bigger enum.

**Enforcement is real, not just a UI gate**: `apps/api/src/auth/admin.guard.ts`
re-checks `role` from Postgres on every single admin-route request — see
that file's own comment for why it doesn't trust the session-cached
copy `apps/web` uses for its own UI-only gate.

### 2. Classifier service: Perspective API for text, image/NSFW classification deliberately not wired to a live service

Perspective API (`classifier.service.ts`) is real, free, and its exact
request/response shape was read from Google's own docs before writing
the integration, not guessed. `classifyImage` is a stub that always
returns `null` — see that function's own comment for why: every
credible NSFW classifier is a paid, metered, separately-billed service,
and there is no image-bearing user content anywhere in this codebase
yet (CHOSN's product photos are catalog data the team enters, not user
uploads) to actually feed it. Wiring billing to a service with nothing
real to call it on is the same "solved before it's needed, badly"
failure task 6 exists to prevent, just on the image side instead of
text. The integration point — the function signature — exists;
swapping in AWS Rekognition/Cloud Vision SafeSearch/Sightengine when an
image-upload feature actually ships is a body-only change.

## Anonymity audit (task 3) — actual findings, not assumed-clean

Audited every current user-facing surface for whether it exposes
another user's email or real name. Findings, checked by reading the
actual code, not inferred:

- **`AuthNavStatus`** (Masthead's signed-in state): shows "Account" /
  "Sign out" only. No email, no name, to anyone — including the signed-
  in user themselves in this component.
- **`/account/security`**: shows `session.user.email` — but only to the
  account's own owner, viewing their own settings page. Not a leak.
- **Day 14's notification/subscription surface**
  (`NotificationsController`, `apps/web/src/lib/notifications.ts`):
  reads/writes by `subscriberId` (a UUID), never by email, and nothing
  renders one subscriber's data to a different caller — there is no
  "who else is subscribed to this drop" UI anywhere. The one gap: `GET
  /notifications/subscriptions?subscriberId=X` doesn't verify the
  caller *owns* that `subscriberId` — anyone who somehow obtained
  another visitor's UUID could read their brand/model subscription
  list (not their email — that's not in the response). Realistic risk
  is low (UUIDv4 isn't guessable, and there's no page that displays
  another visitor's `subscriberId` for anyone to obtain), but it's a
  real, disclosed gap, not a clean bill of health — worth closing when
  `subscribers` gets folded under real auth the way `waitlist_entries`
  already was in Day 16's reconciliation.

**Conclusion**: no current surface leaks a real email or name to
another end user. The honest reason is scope, not diligence — there is
no user-to-user visible surface at all yet (no profile pages, no
"who's here" list, no comments). The actual risk this audit protects
against is prospective: the day a profile page, a comment byline, or a
"members interested in this drop" list gets built, it must render
`display_name`/`AvatarIdenticon`, never `name`/`email`/`image`. That's
now a one-line code-review check against real columns that exist,
rather than a norm someone has to remember.

## Blocking enforcement contract (task 2)

`user_blocks` exists with limited surface area to enforce it on today —
there's no post feed, DM inbox, or @mention system yet. The contract
every future feature must follow, so none of them need to invent this
independently:

1. **Call `BlocksService.isBlockedEitherWay(userA, userB)`** (exported
   from `TrustSafetyModule`) before rendering one user's content to
   another, or before allowing one user to contact another. "Either
   way" is deliberate — enforcement doesn't care who blocked whom.
2. **Check at write time for anything that creates contact** (sending a
   DM, @mentioning someone) — not just read time. A block that only
   hides existing content but doesn't stop new contact from reaching
   the blocked-from party isn't a functioning block.
3. **A block is silent** — the blocked user is never notified they've
   been blocked, and blocking doesn't retroactively delete anything
   that already existed (mirrors the DM-safety policy's own framing:
   this is about stopping future contact, not erasing a record).
4. **Blocking is unilateral** — no confirmation, no cooldown, takes
   effect on the next request that checks it.

## What's explicitly out of scope today

- A "block user" UI — there's no user-to-user surface yet to block
  someone *from*; the API and its contract exist so this is a UI-only
  addition once one does.
- Self-service admin-role granting.
- Any real NSFW image classification (see Assumption 2).
- Actually populating the transparency report — there is no report
  history yet.
