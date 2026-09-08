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

## "Instant" mechanism — architecture (design only, Day 13 builds this)

```mermaid
flowchart LR
    subgraph Trigger
        A[Scheduler/watcher\npolls upcoming DropEvents\nagainst release_date+time+tz] -->|status: upcoming → live| B[(Postgres\ndrop_events.status)]
        W[Manual/webhook override\n– e.g. retailer confirms early] -->|status: upcoming → live| B
    end

    B --> C{Redis Pub/Sub\nchannel: drop-events}

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
'live'`.

**One publish, many consumers.** That single status change publishes
one event to a Redis Pub/Sub channel (`drop-events`, using the Redis
already provisioned for Market Intelligence's cache — no new
infrastructure). The payload is small and self-contained (`dropEventId`,
`sneakerId`, `status`) — consumers re-read whatever they need from
Postgres rather than the event carrying a denormalized copy that can go
stale.

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

## What Day 13 can now build without redesigning anything

- The scheduler/watcher, reading/writing `drop_events.status` through
  the partial index above.
- The Redis Pub/Sub publisher and its three consumers, against the
  `drop-events` channel contract described here.
- Web-push subscribe/unsubscribe endpoints, writing to `subscribers` +
  `web_push_subscriptions` + `notification_subscriptions`.

## What's still open (not blocking Day 13)

- Sign-off on the lightweight-identity (`subscribers`) approach vs.
  building real accounts first.
- Sign-off on the hybrid content-sourcing strategy and its ongoing cost
  (licensing fee or editorial time — not yet quantified against a
  specific vendor).
- No specific licensed-feed vendor is chosen — a separate decision once
  the hybrid strategy itself is signed off.
