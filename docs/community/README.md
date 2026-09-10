# Community: structured posts + live drop chat (Day 21/22)

Day 21's actual deliverables (the generic post-type template, the feed,
Price Check, and wiring Day 17's safety infrastructure into it) didn't
exist before today — an earlier session pasted the Day 17 brief a second
time under a "Day 21" label by mistake. This document covers both:
Day 21's foundation, built first, and Day 22's three additional post
types plus live per-drop chat, built on top of it in the same session.

## What shipped

- **One `posts` table for all four types** (task 4's "generic post-type
  template"), not one table per type — nullable type-specific columns
  (`sneaker_variant_id`, `drop_event_id`, `legit_check_checklist`), a
  check constraint enforcing which type carries which. See
  `apps/api/src/db/schema.ts`'s own header comment on this section and
  `apps/api/drizzle/0012_community.sql`.
- **Price Check**: `sneaker_variant_id` + auto-attached Market
  Intelligence card (`MarketIntelligenceService.getCached`, the same
  service the price-comparison page already uses).
- **Cop or Drop**: its own `poll_votes` table (not the generic `votes`
  table — a two-option pick isn't a +1/-1 score), live cop%/drop% bar.
- **Legit Check**: a per-post, configurable checklist
  (`legit_check_checklist` jsonb — `{id, label}[]`, not a hardcoded
  enum), multi-photo upload through Day 17's `classifyImage` stub
  before display, comments doubling as community verdicts (no separate
  verdict table).
- **Drop Talk**: `drop_event_id` FK, a "Start a Drop Talk post" CTA on
  the drop detail page.
- **Generic infrastructure every type shares**: `comments`, `votes`
  (upvote/downvote for posts *and* comments), block-aware feed
  filtering, the shared card shell + vote/comment controls (task 4).
- **Per-drop live chat**: `chat_rooms` + `chat_messages`, a
  `ChatRoomSchedulerService` mirroring Day 13's `DropSchedulerService`
  shape exactly, a `ChatGateway` extending Day 14's `ws`-based
  connection pattern with real room scoping, a rate-limited chat UI on
  the drop detail page.
- **Chat report/block enforcement** (task 7, added in a follow-up pass
  after the first version shipped only the moderation-classifier half):
  a `ReportButton` on every chat message (the same generic
  `POST /trust-safety/reports` posts/comments will eventually use, not a
  chat-specific endpoint), plus block enforcement on both sides —
  `ChatGateway.send` computes the sender's blocked-either-way set once
  per message and skips those specific recipients in the room broadcast,
  and `ChatMessagesService.history` filters a blocked author out of a
  signed-in viewer's REST history the same way `PostsService.list`
  filters the feed. Verified with a real 3-account test (blocker,
  blocked, bystander): the blocked user's live message reaches the
  bystander but not the blocker, and REST history agrees.

## Assumptions flagged for override

### 1. Chat rooms skip the 'scheduled' status — created already 'open'

The schema keeps `chat_room_status` as `'scheduled' | 'open' | 'archived'`
(room for a future "chat opens in 40m" countdown UI without a schema
change), but today's scheduler only ever inserts a room once its
1h-before-release window has already arrived, directly as `'open'`. The
brief's "auto-create... when the window approaches" read as one event
(create = open), not two — pre-creating a room earlier in a `'scheduled'`
state and flipping it later would be real, currently-unneeded
complexity. Revisit if a genuine "coming soon" chat-room UI is wanted.

### 2. Legit Check photo uploads: any signed-in user, not just the post's author

Task 2 frames Legit Check as a community-verification thread — multiple
people contributing photos to answer the same checklist is the intended
shape, not a solo upload gated to the original poster. Enforced nowhere
except "you must be signed in" (`ApiAuthGuard`). Revisit if this turns
out to invite abuse (someone uploading unrelated/bad photos to another
person's thread) — the fix is an `authorUserId === post.authorUserId`
check in `PostImagesService.attach`, not a schema change.

### 3. Local disk storage for uploaded images, not cloud storage

`apps/api/uploads/`, served via `useStaticAssets`. No S3/Cloudinary/etc.
configured — consistent with this whole feature's brief explicitly
scoping it to local dev ("Everything runs locally"). **This does not
survive a real deploy as-is**: Railway's filesystem isn't durable across
redeploys, and multiple instances wouldn't share the same disk. Needs a
real object-storage provider wired in before this ships to production —
flagged here rather than discovered the first time an uploaded photo
disappears after a redeploy.

### 4. Comment threading is flat, not nested

One `comments` table, no `parent_comment_id`, no reply-to-a-reply. The
brief never asked for threading, and Legit Check's "comments are
verdicts" framing (task 2) reads as a flat list of opinions, not a
nested debate. Revisit if a real UGC pattern emerges that needs it — the
column is a cheap add later, not a reason to build it speculatively now.

### 5. `excludeBlockedContent` shipped as `BlocksService.blockedUserIds`, not a query-wrapper

Day 17 flagged this gap and left it unbuilt until a real caller existed.
The community feed is that caller. What shipped is a method returning
the blocked-either-way user id set (`blockedUserIds(userId)`), which the
feed query does `author_user_id NOT IN (...)` against — not a function
that wraps an arbitrary query object, since the two call sites that
exist today (Drizzle-based `CommunityService`, raw-`pg.Pool`-based
`TrustSafetyModule`) don't share a query-builder type to wrap in the
first place. An id array composes cleanly with either.

## Chat moderation: broadcast-then-review (explicitly approved tradeoff)

Task 7 asked this be flagged for sign-off — it was, and broadcast-then-
review is the direction taken. A chat message is stored and broadcast to
its room **immediately**; `classifyText` runs after, asynchronously, and
only matters for the rare case where it resolves `'flagged'` — the
message is then retracted (removed from the DB and pulled from every
connected client via a `chat:retract` frame) after the fact. The
classifier never sits between "hit send" and "message appears," because
that latency is worst exactly when a drop is hottest and message volume
highest — the same tradeoff Twitch/Discord-style live chat makes, not a
shortcut invented for this feature. The alternative (block-then-broadcast)
would mean every message waits on an external API round-trip before
anyone sees it.

## Local verification

Ran as real HTTP/WebSocket calls against the live local server (not
service-method calls) — the actual guards, DTO validation, and gateway
wiring a real client hits. All four post types created and rendered
correctly in the feed; Cop or Drop poll voted from two accounts with the
percentage bar confirmed correct; a Legit Check image uploaded and
classified (`'clean'`, the stub's no-op resolution); a fresh
`drop_event` with an already-open release window had its chat room
auto-created by the real scheduler (not simulated) within one polling
interval; two live WebSocket sessions confirmed real-time delivery
(session A sends, session B receives) and REST history agreement.

## Day 23: reputation v1, and a hardening pass across all of the above

### Reputation formula — flagged for override

`user_reputation` (0013_reputation.sql): `score`, `verified_purchase_count`,
`helpful_votes_received`, `account_created_at`, `last_calculated_at`. The
formula lives in `ReputationService`'s own doc comment, repeated here
because these are exactly the numbers worth a conscious decision rather
than an arbitrary default:

```
score = min(accountAgeDays, 60) * 1        // accountAgePoints, caps at 60 days
       + helpfulVotesReceived * 3          // helpfulVotePoints
       + verifiedPurchaseCount * 25        // verifiedPurchasePoints — always 0 today
```

`helpfulVotesReceived` sums `max(0, netVotes)` across every post/comment
a user authored — a piece of content that nets negative contributes
nothing, not a penalty, so v1 rewards good contributions rather than
punishing someone for trying. `verifiedPurchaseCount` has no real data
source: CHOSN never processes a purchase (price intelligence, not a
marketplace — see the product's own framing), so the column and its
weight exist as a documented placeholder, ready to activate once a real
signal exists (a manually-verified Legit Check, a confirmed "View Deal"
click-through), and stays at 0 for every user until then.

Freshness: `getForUser` reads a stored column (never computed live on
render), kept current by (a) `VotesService.cast` triggering a
best-effort recalculation of the voted-on content's author after every
vote, and (b) `ReputationSchedulerService`, a recurring BullMQ job (6h
default) that recalculates every user in one set-based SQL statement —
the backstop that keeps age-only points moving forward for someone
nobody has voted on recently.

### The one gated action — also flagged for override

Posting a **Legit Check** requires `score >= 3`
(`LEGIT_CHECK_MIN_REPUTATION` in `reputation.service.ts`) — reachable in
~3 days of account age alone, or a single net-positively-voted
comment/post, whichever comes first. Deliberately fast and multi-path:
the point is blocking a same-session mass-signup spam account, not
gatekeeping a genuine new user who just found the site. No other action
is gated. Chat access during high-traffic drop windows was considered
and deliberately **not** built: restricting exactly the highest-
excitement, highest-new-signup moment seemed more likely to alienate
real new users than to meaningfully slow spam, and Day 22's per-user
rate limit + broadcast-then-review classifier already cover the actual
abuse case (flooding, bad content) without an account-standing gate.

### A real gap this QA pass found: reports were never enforced

Before today, `/admin/reports` showed a raw `reportedEntityType` +
`reportedEntityId` with no content preview, and "Action taken" only
ever flipped `reports.status` — nothing ever set `is_removed` on the
actual post/comment/message being reported. The moderation loop looked
complete (report → queue → action) but the "action" step did nothing to
the content. Fixed in `ReportsService`: `list()`/`create()`/`review()`
now resolve a real `contentPreview` (title+body / comment body / message
body, truncated) by looking up whichever table `reportedEntityType`
names, and `review()` sets `is_removed = true` on that row when an admin
actions the report — the enforcement every read path (feed, post page,
comment thread, chat history) was already filtering on, just never
being set from here. A message-type action also publishes to a new
`moderation:message-retracted` Redis channel (`moderation-events.pubsub.ts`,
same shape as `drop-events.pubsub.ts`), which `ChatGateway` subscribes
to and turns into the same live `chat:retract` frame the classifier's
own auto-flag path already sends — a still-connected viewer loses a
moderator-actioned message immediately, not just on next history fetch.
Verified end to end (real HTTP + a live WebSocket that stayed connected
through the action) for all three content types.

Not built: showing removed content back to the original reporter in the
normal feed ("still see context" for a moderator is satisfied by the
admin queue's own preview, which reads regardless of `is_removed`).
Reporter-side visibility would need every feed/thread/history query to
check the reports table per row — real added complexity for an edge
case the brief's own wording ("the moderator/reporter, who should still
see context") reads as most literally about the moderator. Revisit if
that turns out wrong.

### Image upload hardening: flagged content is now rejected, not labeled

`PostImagesService.attach` used to insert a `'flagged'` row regardless
of the classifier's verdict — the row existed, the file stayed on disk
and reachable by URL, and `'Removed — flagged by review'` was only ever
a client-side label. Since `classifyImage` already runs synchronously
before the row is created (unlike chat's deliberate broadcast-then-
review tradeoff — there's no latency budget being protected here), a
flagged verdict now deletes the uploaded file and rejects the request
outright, the same as a bad mime type or an oversized file. Verified by
temporarily forcing the classifier stub to return `{ nsfw: true }` for
one local test cycle (it's a documented no-op today — see
`classifier.service.ts` — so no real NSFW image was needed or used),
confirming rejection + file cleanup, then reverting. Multer's own
`limits.fileSize` (8MB) and extension allowlist were already correct;
verified directly with a 9MB upload and a `.exe`-renamed file, both
rejected. A rejection was also previously swallowed silently by the
composer UI (`handleUpload` discarded the error) — fixed alongside this,
since a real rejection reason now exists to show.

### Chat load test

`apps/api/loadtest/chat-room-load-test.js` — a hand-rolled `ws`-based
harness (no k6 binary in this environment; a plain WebSocket load
script is a "WebSocket-capable load tool" per the brief's own wording,
and it can assert on this gateway's actual frame shapes directly). 50
authenticated senders (each attempting well above the 10 msg/min limit
on purpose) + 250 anonymous viewers, one room, 60s, run against the
local dev server:

- 300/300 connections succeeded, 0 failures.
- 1,392 send attempts; **892 correctly rate-limited** — the per-user
  limiter holds under concurrent load, not just for one connection in
  isolation.
- Broadcast latency (send → another client's frame): min 8ms, p50 57ms,
  p95 940ms, max 1.4s. The tail is real and worth watching — 300
  clients means `broadcastToRoom`'s per-client loop does up to 300
  synchronous `.send()` calls per message on Node's single thread — but
  every message still delivered, nothing dropped or errored.
- An unrelated endpoint (`GET /community/posts`), polled throughout the
  spike: 0 errors, p95 47ms, max 1.1s (one visible blip during the
  heaviest broadcast burst, not a sustained degradation) — one room
  under load doesn't take down the rest of the app.

### Accessibility fixes made during this pass

- Chat: a visually-hidden `aria-live="polite"` region announces each new
  incoming message to a screen reader, separate from the message list
  itself (which isn't live — announcing 100 history rows on mount would
  be wrong). The per-message report button was `opacity-0` on hover only
  (`group-hover`) with no `group-focus-within` counterpart — a real
  keyboard-nav failure (focused but invisible), fixed.
- Legit Check photo grid: images carried `alt=""` — for a post type
  whose entire point is "look at these photos," that told a screen
  reader to skip the content entirely. Now carries the checklist item's
  label.
- Vote score and the report-reason `<select>` were missing
  `aria-live`/`aria-label` respectively; both added. Vote buttons
  themselves were already correct (`aria-pressed`, `aria-label`, real
  `<button>` elements) — no change needed there.
- Cross-browser/Safari iOS: no real device or browser automation is
  available in this environment, so this was a code-level review, not a
  live device test — flagged as the one item in this brief this session
  could not literally verify. Nothing found is Safari-specific (no
  `capture` attribute forcing the file input into camera-only mode, no
  `100vh` layout in the chat surface, WebSocket reconnect already
  handled with backoff); worth a real on-device pass before a wider
  launch.
