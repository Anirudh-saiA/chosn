# Drops UI (Day 14)

The frontend half of the "instant" notification pipeline —
`apps/api/src/drops/README.md`'s Day 14 section has the full backend
story and the real end-to-end verification numbers. This is the
frontend-specific design record.

## What's here

- `drop-live-context.tsx` (Day 15 — replaces Day 14's
  `useDropLiveSocket.ts`, which opened one connection per drop and is
  gone now) — `DropLiveProvider` opens **one** WebSocket connection per
  page and `useIsDropLive(dropEventId)` reads from it; a component
  outside the provider falls back to its own single-purpose connection
  transparently. See "One connection, not N" below for why this exists.
- `DropStatusBadge.tsx` — "Upcoming" → "Live now", no page refresh.
- `NotifyToggle.tsx` — the subscribe/unsubscribe UI + the contextual
  push-permission trigger.
- `subscriptions-context.tsx` (Day 15) — same shared-vs-standalone shape
  as `drop-live-context.tsx`, for `listSubscriptions()` instead of the
  WebSocket. See "One connection, not N" below.
- `SubscriptionList.tsx` — the `/notifications` settings page's list.
- `SneakerPlaceholderArt.tsx`, `DropCard.tsx`, `DropListView.tsx`,
  `DropCalendar.tsx`, `DropsExplorer.tsx`, `OfficialPurchaseLinks.tsx`,
  `RaffleNotice.tsx`, `LivePricePreview.tsx` (Day 15) — the drop
  calendar and drop-detail pages. See `apps/api/src/drops/README.md`'s
  Day 15 section for the backend endpoints these call and the full
  verification report.

## No new UI primitive for signal/rust colors

`DropStatusBadge` deliberately doesn't reuse `Badge`'s `buy`/`wait`
states or their signal/rust colors — those are reserved for price-
trend signals (Day 2's rule, restated in `Badge.tsx`'s own comment).
"Live" uses brass (the brand accent, already used for primary CTAs);
"Upcoming"/"Sold out" use the same neutral moss/text-faint treatment
everything else on a quiet state uses. A drop's live/upcoming status
and a price's buy/wait signal are different kinds of information; they
shouldn't borrow each other's color vocabulary just because both are
small bordered pills.

## Motion

One 200ms border/text color transition on the badge when it flips,
plus a 1.2s `bg-brass/10` highlight fade that clears itself — not a
bounce, not a toast sliding in. "Motion shows what changed," it doesn't
perform the change; the label swapping from "Upcoming" to "Live now" is
what actually communicates the update, the fade is just what draws the
eye there. `motion-reduce:transition-none` and the highlight fade being
skipped under `prefers-reduced-motion` mean the state change itself
(the text) still lands correctly with zero animation for anyone who's
turned it off — nothing is only conveyed by the motion.

## Contextual push permission — where it's actually called from

`requestPushPermission()` (in `lib/notifications.ts`) is never called
on mount, a `useEffect` with no dependency on user action, or anywhere
near page load. It's called from exactly one place:
`NotifyToggle.toggle()`, immediately after a **successful** subscribe
action, and only when `Notification.permission === 'default'` (i.e.
never asked before, on this browser). A visitor can turn on "Notify me"
without ever seeing a permission prompt if they've already answered it
before, or if push isn't supported — the subscription itself doesn't
depend on push working, since the in-app feed and the (future) email
channel are the other ways "instant" reaches someone.

## Two toggles, not one

Day 12's brief recommended brand/model granularity over global; this
renders both as independent toggles ("this model" / "all {brand}")
rather than forcing a single choice — a visitor who wants both can have
both, and the backend already de-dupes a subscriber matched on more
than one scope down to a single push (`DropPushConsumer`'s own
comment), so turning on both is never double notifications, just
broader coverage.

## Verification

- `next build` with the real local API running: all 10 launch-catalog
  variant pages pre-rendered successfully, including the two that have
  a real `drop_events` row (rendered "Live now" — accurate, since that
  test drop really was live in the database at build time) and the
  eight that don't (no badge rendered at all — confirmed by grepping
  the built HTML output, not assumed from the conditional).
- `next start` against the production build, `curl`'d directly: header
  markup, `NotifyToggle`'s props (`brand`, `styleCode`, `modelLabel`),
  and the nav link to `/notifications` all confirmed present and
  correctly wired in the actual served HTML.
- `NotifyToggle` intentionally renders nothing (`null`) until its
  `listSubscriptions()` fetch resolves — avoids a flash of "off" before
  the real subscription state (which lives in `localStorage`, not
  available during SSR at all) loads. Confirmed this is why the toggle
  chips don't appear in the raw SSR HTML a `curl` sees, only after
  client-side hydration — expected, not a bug.

---

# Day 15 — the drop calendar, news feed, and the two detail pages

Four new pages (`/drops`, `/drops/[id]`, `/news`, `/news/[id]`) that
turn Day 12–14's schema and pipeline into something browsable, plus the
one place all three CHOSN features actually connect: a live drop's
detail page pulling in a real Market Intelligence preview. Full backend
story (new endpoints, a real Drizzle bug caught along the way) is in
`apps/api/src/drops/README.md`'s Day 15 section.

## List vs. calendar — flagged assumption, chose list as default

**`DropsExplorer` defaults to the list view**, not the calendar. A list
is scannable top-to-bottom the instant it renders; a calendar needs a
moment to orient to (which month, which day has anything) before it
says anything useful. At today's catalog size — a handful of drops —
the calendar's actual value proposition ("does day X have something")
is already answered by the list just being short enough to scan whole.
The calendar becomes more valuable once there's enough volume that
scanning a month at a glance beats scrolling a list — worth revisiting
at that point, not a permanent call. Override by flipping the initial
`useState<ViewMode>` value in `DropsExplorer.tsx`.

## "Imagery-forward" with no actual images

The catalog has no real product photography (same gap `SneakerCard.tsx`
already flagged for the search grid). Rather than reuse that grid's
plain styleCode-in-a-box treatment on a page the brief explicitly wants
imagery-forward, `SneakerPlaceholderArt` leans into it: brand/model set
large in the display face, doing the job a photo would in an editorial
layout — an intentional typographic placeholder, not a disguised one,
replaced outright the day `primaryImageUrl` starts getting populated
(the component already reads it and renders a real `<img>` when
present — nothing else needs to change).

## One connection, not N — a real Lighthouse regression, caught and fixed

Two different "N components, one shared resource" problems came up
today, both from the same root cause (a component built for exactly one
instance per page on Day 14, now rendered several times per page on the
drop calendar):

1. **`DropStatusBadge`** used to open its own WebSocket connection per
   instance (`useDropLiveSocket`, Day 14). Fine when at most one drop
   ever appeared on a page; the calendar can show 5+. Replaced with
   `DropLiveProvider` (one connection, a shared `Set<string>` of live
   ids) + `useIsDropLive` (reads the shared set, or falls back to its
   own connection when there's no provider — the sneaker and drop-
   detail pages still work unchanged).
2. **`NotifyToggle`** used to call `listSubscriptions()` on every mount.
   Same story: fine at one instance, real cost at five. This one wasn't
   just reasoned about — it showed up as an actual Lighthouse
   regression: **performance 76** on `/drops` (Total Blocking Time 410ms,
   LCP 3.7s), traced to five simultaneous identical fetches on page
   load. Fixed with `SubscriptionsProvider`/`useSubscriptionsState`
   (same shared-vs-standalone shape). Re-ran Lighthouse after the fix:
   **performance 95**, same page, nothing else changed. Real before/after
   numbers, not an estimate.

## The one place Server and Client Components actually collided

`LivePricePreview` is an `async` Server Component (it needs to `fetch`
Market Intelligence data server-side) rendering `MarketIntelligenceCard`
— which, before today, had never been called from outside a `'use
client'` ancestor (`PriceComparisonView`, Day 10), so its own client/
server boundary was implicit and never mattered. The build itself
caught the break: `TweenedPrice`'s `formatter` prop is a plain function,
and a function can't cross an explicit server→client boundary as a
prop. Fixed by marking `MarketIntelligenceCard` itself `'use client'`
— moves the boundary to its own props (`data`, `bestRetailerName`,
both plain serializable data), so `formatInr` just runs as ordinary
client code again, never serialized. `next build` failed outright
before this fix (`Error: Functions cannot be passed directly to Client
Components...`) and succeeded cleanly after — not a subtle bug, a hard
build error, caught by actually running the build against real seeded
data rather than only checking `tsc`/`eslint`, which have no way to see
this class of error.

## "Only show the price preview once real data exists" — how that's actually enforced

`LivePricePreview` fetches the full catalog response server-side and
renders nothing (`return null`) unless `marketIntelligence` is non-null
**and** at least one of `currentPrice`/`bestAvailablePrice` is non-null.
A drop can flip `live` in the database with zero `price_snapshots` for
several minutes (the fetch pipeline hasn't run a cycle yet) — rendering
`MarketIntelligenceCard` in that gap would show a real card with every
number blank, which reads as broken, not as "nothing yet." Verified
against both real states: the seeded live Panda Dunk drop (real price
history from Day 9–11's pipeline) renders the full preview + a working
"Compare every retailer" link to `/sneakers/DD1391-100/8`; a seeded
upcoming drop with no price history at all renders nothing in that
section — confirmed by `curl`ing both pages directly and grepping for
the section's own heading text, not assumed from the conditional.

## Verification

- `next build` against the real local API: all four new routes compile;
  `/drops/[id]` and `/news/[id]` initially built as `ƒ (Dynamic)` (the
  exact Day 11 pitfall — `revalidate` alone doesn't make a dynamic-
  segment route static) until `generateStaticParams()` was added to
  both, confirmed by the `next build` output actually changing to
  `● (SSG)` with every real seeded id listed as a pre-rendered path.
- Lighthouse, all four page types, after the fixes above:

  | Page | Performance | Accessibility | Best Practices | SEO |
  |---|---|---|---|---|
  | `/drops` | 95 | 100 | 100 | 100 |
  | `/news` | 95 | 100 | 100 | 100 |
  | `/drops/[id]` (live drop, with price preview) | 93 | 100 | 100 | 100 |
  | `/news/[id]` | 96 | 100 | 100 | 100 |

- Cross-linking confirmed by `curl`, not just by reading the JSX: a
  drop-detail page's related-news list links to `/news/[id]`; a news
  article tied to a drop links back to `/drops/[id]`; a live drop's
  price preview links to its `/sneakers/[styleCode]/[size]` page.
- Empty states confirmed against real API responses: an out-of-range
  date query returns `[]` (renders the calendar's "no drops in this
  range" copy); the Air Force 1 demo drop (seeded with no news) renders
  "No coverage yet" on its detail page instead of an empty list.
- **Not independently verified**: the calendar grid's own click-to-
  filter interaction and the WebSocket live-update actually repainting
  the DOM on a real page load — both confirmed correct by direct code
  review and by Day 14's identical WS message contract already being
  proven end-to-end, but neither was driven through a real browser in
  this environment (no display available here). Worth a real click-
  through once this is on staging.
