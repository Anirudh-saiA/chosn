# Drops & news (Day 12 — schema + architecture, no code yet)

Phase 3, Feature 3: instant launch news/drops. This is a Day 1-style
day — the goal was to lock the data model and content strategy before
writing a scheduler, a consumer, or a UI component, so Day 13 (the
watcher + pub/sub pipeline) and Day 14+ (the magazine UI) build against
something settled instead of discovering a schema gap mid-build. No
runtime code changes today; the deliverable is
`apps/api/drizzle/0006_drops_and_news.sql` (applied and hand-verified
against local Postgres — inserts, the scope check constraint, and both
unique constraints all confirmed to behave as designed) plus this
document.

## Schema

### `drop_events`

| Column | Notes |
|---|---|
| `sneaker_id` | FK → `sneakers`, `CASCADE` — a drop only exists for a catalogued sneaker. |
| `release_date` | `DATE NOT NULL` — always known before the exact hour is. |
| `release_time` | `TIME`, nullable. `NULL` means "date confirmed, hour TBA" — a real, displayable state (Day 14 renders this as "Oct 1 · time TBA"), not missing data. |
| `release_timezone` | IANA zone name (`Asia/Kolkata` default), not a stored offset — an offset silently goes wrong across a DST boundary, a zone name never does. |
| `regions` | `region[]` — reuses Day 1's existing enum (`india`/`us`/`global`) rather than inventing a new one. |
| `retail_price`, `currency` | Same shape as `sneakers.retail_price` / `currency`. |
| `status` | `upcoming` / `live` / `sold_out` — see the pub/sub section for what flips it. |
| `purchase_links` | `JSONB`, official retailer links only — **never** the resale price-comparison offers `price_snapshots` already tracks. See the legal note below on why these two link types must never render without a visible distinction. |
| `raffle_info` | `JSONB`, nullable — see the decision below. |

**v1 covers raffles, minimally.** Many hyped Indian/global drops (Nike
SNKRS Draw, adidas Confirmed) are raffle-based, not first-come-first-
served, and that changes Day 14's primary CTA from "Buy now" to "Enter
raffle" — deferring this to v2 would mean redesigning the drop detail
page's most important button shortly after shipping it. So `raffle_info`
exists now as a nullable JSONB blob: `registration_url`,
`registration_closes_at`, `method`. CHOSN never runs the raffle itself —
this is metadata for a link-out, identical in spirit to how `retailers`
already stores affiliate templates rather than payment logic. No new
table, no entry-tracking, no "did I win" state — that would mean CHOSN
holding user PII tied to a giveaway it doesn't run, which is scope and
liability this feature doesn't need.

**One deliberate v1 simplification:** one `release_date` /
`release_time` pair per `DropEvent`, not one per region. A drop that
genuinely goes live at different local times in India vs. globally needs
either two `DropEvent` rows or a future per-region timing column — out
of scope today because the launch catalog's drops are India-first single
events; revisit if/when a multi-region simultaneous drop with staggered
local times actually needs modeling.

### `news_items`

| Column | Notes |
|---|---|
| `drop_event_id` | FK → `drop_events`, nullable, `SET NULL` on delete — not all news is drop-specific (a policy change, a general sale event). |
| `source` | Attribution string — `"CHOSN editorial"` for originals, the feed's own name otherwise. Always shown, never blended. |
| `source_url` | Set only when `body` is sourced from a licensed/aggregated feed — the "link to the original" a licensing deal typically requires, and the audit trail for the copyright check below. |
| `is_breaking` | The **only** signal that triggers an instant push — see §5 of the brief and the pub/sub section. Ambient news (a routine restock note, a minor price-history blurb) publishes to the feed quietly; it does not fan out to push/WebSocket/email. This is what keeps subscribers from unsubscribing after the first week. |

### `subscribers`, `web_push_subscriptions`, `notification_subscriptions`

**Flagged assumption — sign-off needed.** CHOSN has no accounts or auth
system at all today. The only existing "person" record is
`waitlist_entries` (Day 5), a one-way capture form, not a login. This
feature is the first one that needs to notify someone, which needs *some*
identity to notify.

Building full authentication (passwords, sessions, login/logout UI) to
unblock a notifications feature is real scope creep for Phase 3, and
most sites don't gate "notify me about drops" behind an account anyway —
a browser-level push permission or a bare email is the normal, lower-
friction pattern (the same one the waitlist form already uses). So:

- **`subscribers`** — `id` + optional `email`. Not an account: no
  password, no session, no login. A row is created the instant a visitor
  enables push or types an email into a "notify me" control.
- **`web_push_subscriptions`** — the standard Web Push API shape
  (`endpoint`, `p256dh`, `auth`), one subscriber can hold several (one
  per browser/device).
- **`notification_subscriptions`** — `(subscriber_id, scope_type,
  scope_value)`, `scope_type ∈ {brand, model, global}`. A `CHECK`
  constraint enforces `scope_value IS NULL` iff `scope_type = 'global'`
  (verified: a `global` row with a non-null `scope_value` is rejected at
  the database, not just in application code), and a `COALESCE`-based
  unique index stops the same subscriber double-subscribing to the same
  thing, including duplicate `global` rows (verified — plain
  `UNIQUE(subscriber_id, scope_type, scope_value)` would not have caught
  that case, since `NULL <> NULL`).

If/when CHOSN builds real accounts, `subscriber_id` is a straightforward
migration target for `user_id` — a `subscribers` row becomes a `users`
row's notification preferences, not a redesign. **Please confirm this
lightweight-identity approach is acceptable for now**, versus building
real accounts first — that's a real product-scope call, not just a
technical one.

**Subscription granularity:** per-brand or per-model, matching the
brief's recommendation — `global` exists in the enum and is fully
functional, but Day 14's UI should present brand/model as the default
choice, with global available for someone who explicitly wants
everything. Global-only notification programs tend to become noise and
drive unsubscribes; the schema doesn't block it, but the product should
nudge away from it.

## Content sourcing strategy — **hybrid (recommended, needs sign-off)**

**Decision:** structured drop-calendar data (release date/time, price,
regions, official purchase links) sourced broadly — scraped or
aggregated from public retailer/brand pages and existing drop-calendar
sites — paired with a short original write-up authored for each drop
involving one of the ~20-30 launch-catalog models (today, actually 5
catalogued models / 10 variants — see the note below). Everything else
in the feed (wider sneaker-world news) either stays uncovered at launch
or is added editorially as capacity allows, never republished from
another outlet's article text.

**Why not editorial-only:** highest quality and cleanest IP position,
but doesn't scale past a handful of drops a week without dedicated
headcount CHOSN doesn't have yet — the same "doesn't scale without
headcount" tradeoff the brief names.

**Why not licensed-feed-only:** fastest coverage, but original-content
SEO value is low (nothing on the page a search engine hasn't indexed
from the licensor already) and it adds an ongoing licensing cost/
negotiation before the feature has proven it drives engagement.

**Why the hybrid split holds up legally:** the load-bearing distinction
is *facts vs. expression*. A release date, a price, a region, a raffle
registration link — these are facts, not copyrightable, and sourcing
them broadly (scraping a retailer's own drop page, aggregating a public
drop calendar) carries the same ToS diligence Day 1 already applied to
retailer price data: check each source's ToS for an explicit
anti-scraping clause before pulling from it, same as Day 1 §01's
retailer-tier review, and prefer an API/feed over scraping wherever one
exists (mirrors Day 1's decision to drop `scrape` as an integration type
entirely for pricing — the same standard should apply here). What is
never acceptable, regardless of ToS, is reproducing another outlet's
article text — the write-up per drop is original, factual data feeds it.

**Ongoing cost this creates, flagged explicitly per the brief's ask:**
either a licensing fee (if a specific structured-feed provider is
chosen — none is contracted yet, this is a strategy decision, not a
vendor decision) or editorial time to write ~20-30 short drop write-ups
plus keep pace with new ones — not zero, and it recurs. **Please sign
off on the hybrid approach itself before Day 13 build starts**; picking
a specific licensed-feed vendor (if any) is a separate decision this
doesn't lock in.

**Correction to the brief's stated catalog size:** the brief's context
references a 20-30 model launch catalog; the actual seeded catalog today
(`apps/api/drizzle/0002_seed_flipkart_and_test_set.sql`) is 5 sneakers /
10 variants (Nike Dunk Low Panda, Air Force 1 '07 Triple White, adidas
Samba OG, adidas Campus 00s, New Balance 550). The schema and sourcing
decision here don't depend on the exact count — they hold at 5 or 30 —
but editorial write-up effort scales with whichever number is real, so
flagging the gap rather than quietly writing "30" into a cost estimate.

## "Instant" mechanism — architecture (design only when written, built Day 13 — see the implementation section below)

```mermaid
flowchart LR
    subgraph Trigger
        A[Scheduler/watcher\npolls upcoming DropEvents\nagainst release_date+time+tz] -->|status: upcoming → live| B[(Postgres\ndrop_events.status)]
        W[Manual/webhook override\n– e.g. retailer confirms early] -->|status: upcoming → live| B
    end

    B --> C{Redis Pub/Sub\nchannel: drop:live}

    C --> D[WebSocket broadcaster\n– users with the page open]
    C --> E[Web-push sender\n– notification_subscriptions\nmatched to the drop's\nbrand/model, + global]
    C --> F[News-feed auto-post writer\n– inserts a news_items row,\nis_breaking = true]

    style C fill:#C6963C,color:#0F1613
```

**Trigger side.** A scheduler/watcher process (Day 13) polls
`drop_events` for rows where `status = 'upcoming'` and
`release_date`/`release_time`/`release_timezone` have passed —
`drop_events_upcoming_idx` (a partial index, `WHERE status =
'upcoming'`) is built for exactly this query, so the poll never scans
live/sold-out rows as the table grows. A manual/webhook path also exists
for the case a retailer confirms a drop went live early or late —
either path ends the same way: one `UPDATE drop_events SET status =
'live'`. (The manual/webhook trigger path itself is not built — Day 13
built the automatic poll only; see "What Day 13 actually built" below.)

**One publish, many consumers.** That single status change publishes
one event to a Redis Pub/Sub channel — named `drop:live` in the actual
build, not the `drop-events` label this diagram used before Day 13
picked the Day 13 brief's own example name — using the Redis already
provisioned for Market Intelligence's cache, no new infrastructure. The
payload is small and self-contained (`dropEventId`, `sneakerId`,
`timestamp`) — consumers re-read whatever they need from Postgres
rather than the event carrying a denormalized copy that can go stale.

Three independent consumers subscribe to that one channel:

1. **WebSocket broadcaster** — pushes to any client with the relevant
   page open (a drop's detail page, or the news feed).
2. **Web-push sender** — queries `notification_subscriptions` for rows
   matching the drop's brand or model, plus every `global` row, and
   sends via the Web Push protocol using each matched subscriber's
   `web_push_subscriptions` rows.
3. **News-feed auto-post writer** — inserts a `news_items` row
   (`is_breaking = true`, `source = 'CHOSN'`, `drop_event_id` set) so the
   "drop just went live" announcement is itself a feed item, not a
   separate notification-only artifact.

**Why pub/sub instead of each consumer polling `drop_events` itself:**
the trigger logic (the scheduler) never needs to know how many consumers
exist or what they do — Day 15+ adding a fourth consumer (e.g.
auto-creating a community chat room for the drop, mentioned in the
brief) is a new subscriber to the same channel, zero changes to the
watcher. This is the actual point of today's design pass: decouple
"detecting a drop went live" from "everything that should happen when it
does."

**`is_breaking` is what gates the push/WebSocket fan-out for *news*
specifically** — a drop going `live` always fans out (that's the
feature), but an editorial `news_items` row only fans out through the
same channel if `is_breaking = true`. A routine "restock expected next
week" post publishes to the feed without waking anyone's phone.

## Legal/compliance check

- **Structured drop-calendar facts** (date, price, region, raffle
  link) — not copyrightable, broad sourcing is fine subject to the same
  per-source ToS check Day 1 already applies to retailer pricing (no
  blanket scraping where a source's ToS explicitly forbids it; prefer an
  API/feed over scraping wherever one exists).
- **Article text from a licensed/aggregated source** — never
  reproduced. `source` + `source_url` exist specifically so a licensed
  fact is always attributed and linked, never presented as CHOSN's own
  writing.
- **`purchase_links` vs. resale offers — the clarity issue the brief
  calls out by name.** `purchase_links` are official retailer links:
  CHOSN earns nothing on them, they are "where to try to buy at retail."
  The existing price-comparison "View Deal" buttons are affiliate links:
  CHOSN earns a commission. These must never render on the same page
  without a visible, textual distinction (not just color) — this is a
  UI requirement for Day 14, flagged here so it isn't discovered as an
  afterthought once the drop detail page is being built. The existing
  `AffiliateDisclosure` component (Day 10) is the right pattern to
  extend, not a new mechanism to invent.

## What's still open (not blocking Day 14)

- Sign-off on the lightweight-identity (`subscribers`) approach vs.
  building real accounts first.
- Sign-off on the hybrid content-sourcing strategy and its ongoing cost
  (licensing fee or editorial time — not yet quantified against a
  specific vendor).
- No specific licensed-feed vendor is chosen — a separate decision once
  the hybrid strategy itself is signed off.

---

# Day 13 — scheduler + pub/sub, built and verified

Turned the design above into running code: the BullMQ scheduler that
flips `drop_events.status`, the `drop:live` Redis Pub/Sub publisher, and
the first consumer (news-feed auto-post). Day 14 adds the WebSocket and
web-push consumers as more subscribers to the same channel — nothing
here changes when that happens, which was the actual point of yesterday's
design pass.

## What was built

| File | What |
|---|---|
| `apps/api/drizzle/0007_drop_scheduler_monitoring.sql` | `drop_scheduler_runs`, `drop_consumer_failures`, and a partial unique index (`news_items_auto_post_unique`) making the auto-post idempotent per drop. |
| `drop-events.pubsub.ts` | The channel name (`drop:live`) and payload shape (`dropEventId`, `sneakerId`, `timestamp`) — the one contract every publisher/consumer agrees on. |
| `drop-scheduler.service.ts` | BullMQ recurring job (default every 1 minute, `DROP_SCHEDULER_INTERVAL_MINUTES`). One atomic `UPDATE ... WHERE status = 'upcoming' ... RETURNING` per tick (the idempotency guard task 2 asked for), then one Pub/Sub publish per flipped row, then one durable run record. |
| `drop-news-auto-post.service.ts` | Subscribes to `drop:live` on its own dedicated Redis connection, re-reads the drop from Postgres, and inserts a `news_items` row via `auto-post-template.ts`. |
| `auto-post-template.ts` | The factual, auto-generated announcement copy — see its own header comment for how this fits the hybrid content strategy (facts, not the human write-up). |
| `drop-health.service.ts` / `drop-health.controller.ts` | `GET /health/drops` — scheduler run history + per-consumer failure counts, same shape as `GET /health/fetch`. |
| `drops.module.ts` | Imports `PricingModule` for the shared pg pool/Drizzle instance rather than opening a third connection pool (WaitlistModule and PricingModule each already open their own — see the module's own comment). |
| `scripts/seed-test-drops.ts` | Seeds 3 real test drops for today's manual run — one 2 minutes out, one 4 minutes out with `raffle_info`, one with `release_time` left `NULL` to prove the "TBA never auto-flips" guard. |

## Two real bugs, caught by actually running this, not by review

**1. The seed script's timezone math was wrong.** `minutesFromNow()`
first built the target date/time from `Date.toISOString()`'s UTC
components, then stored them under `release_timezone: 'Asia/Kolkata'`.
Since `release_date`/`release_time` are naive values the scheduler later
reinterprets via `AT TIME ZONE release_timezone`, storing UTC digits
under an IST label doesn't mean "2 minutes from now in IST" — it means
whatever UTC-minus-5:30 works out to, which in this case was already in
the past. First real consequence: the two seeded test drops were
already "due" the instant they were inserted, and the running
scheduler's very next tick (60 seconds later) correctly flipped both of
them and auto-posted both news items — which is genuinely how the
pipeline is supposed to behave, just against the wrong intended
timestamps. Caught by watching the actual server log rather than
assuming success from a green build. Fixed with
`Intl.DateTimeFormat({ timeZone: 'Asia/Kolkata' })` to derive true IST
wall-clock components, then re-seeded and re-verified against
genuinely-future times (below).

**2. `GET /health/drops` 500'd.** `consumerSummary()` interpolated a
plain JS array into Drizzle's `sql` template expecting it to bind as one
Postgres array-typed parameter, the way raw `node-postgres` does. It
doesn't — Drizzle flattened it to a single bare scalar, and
`'news-feed-auto-post'::text[]` failed with `malformed array literal`.
Caught immediately by actually calling the endpoint (`curl
localhost:4001/health/drops`) rather than trusting the typecheck, which
has no way to know a runtime SQL string is wrong. Fixed with
`sql.join(...)` to build a real `ARRAY[$1, $2, ...]` literal, each
element its own bound parameter — see the code comment for the working
form.

## End-to-end verification — real timing, scheduler left running naturally

Local `next build`-equivalent compiled NestJS, real Postgres + Redis,
`DROP_SCHEDULER_INTERVAL_MINUTES=1`. Per task 6: the scheduler was never
manually triggered — every flip below happened on its own regular tick,
observed by polling the database from a separate process, not by
calling `tick()` directly.

| Drop | Seeded release time (IST) | Scheduler tick that flipped it | Result |
|---|---|---|---|
| Nike Dunk "Panda" (FCFS, `purchase_links` set) | 13:04:48 | 13:05:14 (the next tick after the due time — bounded by the 1-minute poll granularity, exactly as designed) | `status` → `live`; `news_items` row auto-posted, `is_breaking=true`, real copy below |
| adidas Samba (raffle, `raffle_info` set) | 13:06:48 | 13:07:14 | `status` → `live`; `news_items` row auto-posted, exercising the raffle-copy branch |
| New Balance 550 (`release_time = NULL`, TBA) | — | never (by design) | stayed `upcoming` through every tick in this test window, confirming the guard |

Both drops' actual auto-posted copy, byte-for-byte from the database:

> **Nike Dunk "White/Black (Panda)" is live now**
> The Nike Dunk "White/Black (Panda)" (DD1391-100) just went live in
> India. Retail price: ₹12,995. Where to try to buy at retail: Nike
> SNKRS (https://www.nike.com/in/launch/t/dunk-low-panda).

> **adidas Samba "Cloud White/Core Black" is live now**
> The adidas Samba "Cloud White/Core Black" (B75806) just went live in
> India and globally. Retail price: ₹9,999. This is a raffle release via
> adidas CONFIRMED — enter at https://www.adidas.co.in/confirmed.
> Registration closes Tue, 08 Sep 2026 07:35:48 GMT.

`drop_scheduler_runs`, every row from this test window, real values —
a tick with nothing due logs `flipped: 0`, `error: NULL`, not silence:

```
07:31:14.828Z  flipped=0  16ms   (nothing due yet)
07:32:14.821Z  flipped=2  26ms   (the two mistimed-seed drops — see bug #1)
07:33:14.803Z  flipped=0  13ms
07:34:14.775Z  flipped=0   4ms
07:35:14.785Z  flipped=1  18ms  (Panda Dunk, correctly-timed re-seed)
07:36:14.877Z  flipped=0  87ms
07:37:14.793Z  flipped=1  22ms  (adidas Samba, correctly-timed re-seed)
```

Exactly one `drop:live` publish per flip, exactly one `news_items` row
per drop — `total news_items = 4` after this run (2 from the mistimed
first flip + 2 from the correctly-timed re-seed), matching `flipped`
summed across every run, zero duplicates. The
`news_items_auto_post_unique` partial index means a second attempt for
the same drop — e.g. from a second API instance, see 0007's header
comment — would be silently skipped as a benign `23505`, not a
duplicate post; not exercised in this single-instance test, but the
constraint was independently verified during the Day 12 migration
check.

`GET /health/drops` immediately after the run — via the service directly
first (matched the numbers above exactly), then re-verified over real
HTTP after restarting the local server so the compiled fix for bug #2
was actually loaded (a `dist/` rebuild alone doesn't hot-reload an
already-running Node process — irrelevant on Railway, which restarts
the whole process on every deploy anyway, but worth knowing for local
iteration):

```json
{
  "ok": true,
  "scheduler": { "lastRunAt": "2026-09-08T07:37:14.793Z", "minutesSinceLastRun": 0, "runs24h": 7, "flipped24h": 4, "lastError": null, "stale": false },
  "consumers": [{ "consumer": "news-feed-auto-post", "failures24h": 0, "lastFailureAt": null, "lastReason": null }]
}
```

## Failure isolation (task 5)

Not fault-injected today (no reason to believe the isolation pattern
behaves differently here than the identical one already verified for
retailer fetchers in Day 6–7) — the code path is the same shape: the
consumer's `handle()` wraps the whole message-processing call in
try/catch, records a `drop_consumer_failures` row and a Sentry event on
failure, and never rethrows into the ioredis `'message'` handler, so one
bad event can't take down the subscriber connection or affect any other
consumer of the same channel. `DropSchedulerService.publish()` follows
the same shape per-row, so one failed publish doesn't stop the loop or
lose the others.

## Definition of done — met

A seeded `DropEvent` transitioned from `upcoming` to `live`
automatically at its scheduled time (not faked), published exactly one
`drop:live` event, and a `NewsItem` was correctly auto-created with real
facts pulled from Postgres — twice, once per test drop, including the
raffle-copy branch. Day 14 can add WebSocket and web-push consumers as
new subscribers to `drop:live` without touching the scheduler.

---

# Day 14 — WebSocket + web push, the "instant" promise made real

Adds the two remaining `drop:live` consumers Day 13 designed room for
(`DropLiveGateway`, `DropPushConsumer`), plus the subscription
management REST API (`notifications/`) and frontend UI those two
depend on. All three consumers of `drop:live` now run independently —
DropNewsAutoPostService (Day 13), DropLiveGateway, DropPushConsumer —
each on its own dedicated Redis subscriber connection.

## Room scoping — flagged assumption, chose global for v1

**Global broadcast, not per-brand/per-model rooms.** Every connected
WebSocket client receives every `drop:live` event; the frontend filters
client-side by comparing the event's `dropEventId` against the one
page/component actually cares about (see `useDropLiveSocket`'s own
comment in `apps/web/src/components/drops/`).

Why: at today's scale — a handful of launch-catalog drops, a handful of
concurrent viewers — targeted rooms are real implementation cost
(client-side room join/leave bookkeeping on every navigation, server-
side room membership tracking) for a broadcast that costs nothing extra
to send globally. `ws` (the library this gateway uses, not Socket.io —
see its own comment) has no built-in room concept either, so targeted
rooms would mean hand-rolling one. The actual cost of going global is a
few unused bytes on the wire per uninterested client, never a wrong UI
update, since the payload always carries enough to filter on.
**Revisit with targeted rooms once concurrent viewers or drop frequency
are actually high enough for that "unused bytes" cost to matter — this
is a real tradeoff to override, not a settled decision.**

## What was built

| File | What |
|---|---|
| `drop-live.gateway.ts` | `DropLiveGateway` — `ws`-based (not Socket.io), mounted at `/ws/drops`, subscribes to `drop:live`, broadcasts to every open connection. |
| `web-push.service.ts` | `WebPushService` — thin wrapper over the `web-push` library, same no-op-until-configured convention as `EmailService`/`RESEND_API_KEY`. Never throws; every send outcome (`sent` / `gone` / `error`) comes back typed. |
| `drop-push.consumer.ts` | `DropPushConsumer` — the third `drop:live` consumer. Matches `notification_subscriptions` by brand OR model (style_code) OR global, de-dupes a subscriber matched on more than one scope down to one push per endpoint, sends in fixed-size batches (task 7), deletes a subscription on a `410`/`404` "gone" response. |
| `notifications/` | `NotificationsController` + `NotificationsService` — identify (mint/reuse a `subscribers` row), subscribe/unsubscribe (`notification_subscriptions`), list (with friendly labels), push-subscribe/push-unsubscribe (`web_push_subscriptions`). Every mutating endpoint is `RateLimitGuard`'d (task 7). |
| `drops.controller.ts` | `GET /drops/by-style-code/:styleCode` — the small read endpoint the sneaker page needed to know a `DropEvent` exists at all; didn't exist before today. |
| `apps/web/src/lib/notifications.ts` | Frontend API client + the `subscriberId` localStorage lifecycle (mint once via `identify()`, persist, re-identify once on a stale-id 404) + the push-permission flow. |
| `apps/web/public/sw.js` | The service worker — `push` -> `showNotification`, `notificationclick` -> focus-or-open the sneaker page. Minimal on purpose: this app has no other reason for a service worker. |
| `apps/web/src/components/drops/` | `useDropLiveSocket` (the WS client hook), `DropStatusBadge` (Upcoming -> Live, no refresh), `NotifyToggle` (model/brand toggles + contextual push prompt), `SubscriptionList` (the settings page). |

## Two Drizzle correctness issues, both caught by actually running the code

**1. `ON CONFLICT` against an expression index isn't expressible through
Drizzle's typed conflict-target builder.** `notification_subscriptions`'s
uniqueness (0006) is `UNIQUE (subscriber_id, scope_type, COALESCE(scope_value, ''))`
— an expression index, not a plain-column one. `NotificationsService.subscribe()`
uses raw `sql` with the exact expression in the `ON CONFLICT` clause
instead. Verified directly: subscribing to the same scope twice returns
`{ok:true}` both times with only one row in the database (see the
manual endpoint testing below) — not assumed correct from reading the
Postgres docs.

**2. Drizzle's `sql` template does not bind a plain JS array as a single
Postgres array-typed parameter.** Hit this exact class of bug once
already in `DropHealthService.consumerSummary()` (Day 13); this time it
showed up in an early draft of the push-matching query that tried
`scope_value = ANY(${array})`. Same fix as Day 13: build the list with
`sql.join(...)` into a real SQL list/array literal rather than trying to
pass a JS array through as one parameter. Mentioning it again here
because it's the second time this exact mistake happened — worth
remembering as a standing gotcha with this ORM, not a one-off.

## Manual endpoint verification (before the end-to-end test)

Every `notifications/*` endpoint was called directly and checked
against the database, not just trusted from the code:

- `identify` (no email) and `identify` (with email, then called again
  with the same email) — confirmed the second call returns the *same*
  `subscriberId` rather than minting a duplicate `subscribers` row.
- `subscribe` (brand), `subscribe` (model), `subscribe` (brand again,
  duplicate) — confirmed exactly 2 rows exist after 3 calls (the
  `ON CONFLICT` fix above, load-bearing).
- `subscribe` with `scopeType: 'global'` + a `scopeValue` present —
  confirmed `400` with the exact validation message, not a `500` from a
  Postgres `CHECK` violation. (This DTO validator was rewritten once
  already after a direct test — see `subscription.dto.ts`'s own comment
  — because two stacked `@ValidateIf` blocks on one property silently
  don't combine the way they look like they should in class-validator;
  caught by running four cases through `validate()` directly rather
  than trusting the decorator stack.)
- `unsubscribe` (brand) — confirmed the row is gone and the model
  subscription survives.
- `push-subscribe`, then `push-subscribe` again with the same
  `endpoint` and different keys — confirmed one row, updated in place
  (`onConflictDoUpdate` against the plain `UNIQUE` on `endpoint`, which
  — unlike `notification_subscriptions` above — Drizzle's typed builder
  handles natively, no raw SQL needed).
- An unknown `subscriberId` against `subscribe` — confirmed `404
  unknown_subscriber`, not a foreign-key `500`.
- Rate limiting — burst-called `identify` past its 20/hour limit and
  confirmed real `429`s starting exactly where the quota ran out, and
  staying `429` on every subsequent call in the same window (Redis-
  backed persistence, not an in-memory counter that would reset per
  request).

## End-to-end verification — real timing, nothing faked

Same discipline as Day 13: the scheduler was left running on its normal
1-minute poll, never manually triggered. Setup:

- Re-used Day 13's `seed:test-drops` script (unchanged) for a Panda
  Dunk drop a few minutes out.
- A real WebSocket client (Node's native `WebSocket` — the same API a
  browser tab uses, not the server-side `ws` library) connected to
  `/ws/drops` and left open, simulating "one browser tab on the drop
  page."
- A `web_push_subscriptions` row with a **cryptographically valid**
  P-256 key pair (generated via Node's `crypto.createECDH`, so it
  passes `web-push`'s own local validation) pointed at a syntactically
  real but non-existent FCM endpoint
  (`https://fcm.googleapis.com/fcm/send/...`), subscribed to the same
  model — specifically to see what happens past local validation, not
  just that a malformed key gets rejected.

**Result, one real flip, all three consumers independently reacting to
one publish:**

```
13:44:05 IST  drop's scheduled release_time
13:45:00 IST  scheduler tick flips status upcoming -> live, publishes drop:live
13:45:00.092Z  DropSchedulerService publishes
13:45:00.100Z  WebSocket client receives the frame       (+8ms)
13:45:00.xxx   DropNewsAutoPostService auto-posts the NewsItem
13:45:00.xxx   DropPushConsumer: 2 matched, 0 sent, 1 stale (removed), 1 failed
```

**The push outcome is the most informative part, not the least.**
Neither push subscription was a real, permission-granted browser
subscription — this environment has no browser UI to grant one from —
but the two fake ones exercised the two different real failure paths on
purpose:

- The intentionally malformed key (`p256dh` too short) failed **before
  any network call**, inside `web-push`'s own local validation — logged
  as `error`, left in place (not a confirmed-dead endpoint, just a bad
  local input).
- The cryptographically valid key against a syntactically real but
  unregistered FCM URL made an **actual HTTPS request to Google's push
  infrastructure**, got back a real `404`/`410`, and `DropPushConsumer`
  correctly classified that as `gone` and deleted the row — confirmed
  by querying `web_push_subscriptions` immediately after and finding it
  gone, with no `drop_consumer_failures` row written (this is an
  expected, handled outcome, not a failure — see the consumer's own
  comment on why it's logged, not Sentried).

So: real scheduler timing, real Pub/Sub fan-out to three independent
consumers, a real WebSocket round-trip with a measured **8ms**
publish-to-client latency, and a real network round-trip to Google's
own push infrastructure with correct handling of both outcomes it can
return. What wasn't and couldn't be verified from this environment is
the very last hop — an actual OS-level push notification appearing on
a real device after a human clicked "Allow." Everything server-side
feeding that hop was verified for real; that specific last step is a
reasonable, honestly-flagged gap for the person running this on an
actual browser to confirm.

`GET /health/drops` after this run (both consumers now listed, both
clean):

```json
{
  "ok": true,
  "consumers": [
    { "consumer": "news-feed-auto-post", "failures24h": 0 },
    { "consumer": "web-push", "failures24h": 0 }
  ]
}
```

Zero `drop_consumer_failures` rows is correct here, not a gap in
coverage — every outcome above (the malformed-key error, the real
404 cleanup) is handled *inside* `DropPushConsumer.sendBatched()` and
never propagates to the outer catch that writes that table. That outer
path exists for something failing before matching even starts (e.g. the
drop lookup itself throwing) — not exercised today, same as Day 13's
equivalent gap for the news consumer.

## Failure isolation (task 5) — verified, not just structurally argued

Unlike Day 13 (where this section said "not fault-injected today, same
pattern as Day 6-7"), this one *was* naturally exercised: in the single
test run above, `DropPushConsumer` hit two different error conditions
(a local validation failure and a real remote 404) in the same
broadcast that `DropLiveGateway` delivered cleanly to its one client and
`DropNewsAutoPostService` auto-posted without incident. Three
consumers, one publish, one of them degraded in two different ways,
zero effect on the other two — because each owns its own Redis
subscriber connection and its own try/catch boundary, exactly as
designed.

## Copy accuracy (task 4)

`NotifyToggle` tells a subscriber "we check every minute... not to the
second" — a direct, literal statement of `DROP_SCHEDULER_INTERVAL_MINUTES`'s
actual default (1), not a vaguer "instant" claim the scheduler's real
polling interval can't back up. If that env var is ever changed in
production, this copy needs to change with it — flagged in the
component's own comment, not just here.

## What's still open

- The lightweight-identity and hybrid-content-sourcing sign-offs from
  Day 12 are unchanged and still open.
- Targeted WebSocket rooms (brand/model-scoped), if concurrent viewers
  or drop frequency ever make the global broadcast's "wasted bytes"
  cost real — see the room-scoping section above.
- A real end-to-end push test on an actual browser/device, to close the
  one gap this environment genuinely can't verify.

---

# Day 15 — read endpoints for the drops magazine

The backend half of Day 15's frontend build
(`apps/web/src/components/drops/README.md` has the full frontend
story). Four new read endpoints, all public/unauthenticated (a drop's
or article's content isn't sensitive):

| Endpoint | Backs |
|---|---|
| `GET /drops?from=&to=&status=` | The calendar/list view. |
| `GET /drops/:id` | The drop-detail page — sneaker info, official links, related news, and the default (lowest-size) variant to check for a Market Intelligence preview. |
| `GET /news?limit=&offset=&dropEventId=` | The news feed. |
| `GET /news/:id` | The article page. |

`drops.service.ts` / `drops.controller.ts` grew a proper service layer
today — the single `by-style-code` endpoint from Day 14 lived directly
in the controller, which stopped being reasonable with four endpoints
sharing row-shaping logic.

## A third instance of the same class of Drizzle bug — this one was silent, not a crash

Days 13 and 14 both hit "Drizzle's `sql` template doesn't bind a plain
JS array as a single Postgres array-typed parameter" — both times as a
loud, immediate error (`malformed array literal`). Day 15 found a
related but meaner variant: **reading** a `region[]` column back
through raw `db.execute(sql\`...\`)` returns the raw Postgres array-
literal text (`"{india}"`, a string) instead of a parsed JS array —
silently. No error, no crash, just a `string` where the type annotation
claimed `string[]`, only visible by actually inspecting a real response
body (`regions: "{india}"` where `["india"]` was expected) rather than
from the type system, which trusted the annotation.

Root cause, confirmed by testing the *same column* through both Drizzle
code paths directly against Postgres: Drizzle's **typed query builder**
(`.select({ regions: dropEvents.regions })`) correctly returns a real
array, because Drizzle's own column definition knows how to (de)
serialize a `region[]` column. Raw `execute()` bypasses that and falls
back to whatever node-postgres's OID-based type parser gives back —
and node-postgres has no built-in parser for a *custom enum* array type
(unlike `text[]`/`int[]`, which it does parse automatically), so it
returns the unparsed text.

**This is not new to today** — Day 14's `by-style-code` endpoint has the
exact same raw-`execute()` pattern and was returning the same malformed
`regions` field in production since it shipped, silently, because
nothing in the Day 14 frontend actually rendered `regions` from that
specific endpoint. Fixed in both places with a small explicit parser
(`pg-array.ts`'s `parsePgTextArray`), not by switching everything to
the typed builder — several of these queries (multi-table joins,
`CASE`-based ordering) don't map cleanly onto Drizzle's query builder
the way the news-consumer's simpler lookups do.

## Route ordering + a UUID guard

`by-style-code/:styleCode` is declared before the bare `:id` route —
they don't actually collide (different segment counts), but it's the
same defensive convention `CatalogController`'s own comment already
established: static-prefix routes before dynamic ones, so the ordering
stays unambiguous if either route's shape ever changes. `:id` and
`news/:id` both validate with `isUUID()` before touching the database —
without it, a non-UUID id (or the literal string "by-style-code", if
route matching ever did collide) would reach Postgres and come back as
a raw `invalid input syntax for type uuid` 500 instead of a clean 404.

## Verification

- Every new endpoint called directly and checked against real seeded
  data: `GET /drops` (full list, `regions` confirmed as real arrays
  post-fix), `GET /drops/:id` for a live drop (real `purchaseLinks`,
  real `defaultVariant`, `relatedNews` including both an auto-post and
  a hand-seeded editorial piece), the same for an upcoming drop with no
  coverage (`relatedNews: []`), a bad-uuid request (clean `404`, not a
  Postgres error), `GET /news` (mixed sources, breaking flags, and
  `dropSneaker` cross-link data all correct), and confirmed the Market
  Intelligence data backing `LivePricePreview` is real (non-null
  `currentPrice`/`bestAvailablePrice`) before claiming that section
  would render.
- Demo data: cleaned up the ~8 duplicate test `drop_events` that had
  accumulated across Days 13–14's repeated scheduler tests (kept
  exactly one genuinely-flipped live drop per test sneaker, each with
  its real auto-posted `NewsItem` intact), then added
  `seed-demo-drops.ts` — spreads the two remaining launch-catalog
  sneakers across future dates (including into next month, so the
  calendar view has more than one month worth showing) and adds two
  hand-written editorial `NewsItem`s. Doesn't touch or duplicate
  Day 13's `seed-test-drops.ts`, which is a different tool for a
  different job (near-future scheduler timing tests, not browse demo
  content).
