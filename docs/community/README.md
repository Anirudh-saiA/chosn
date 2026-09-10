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
