# Drops UI (Day 14)

The frontend half of the "instant" notification pipeline —
`apps/api/src/drops/README.md`'s Day 14 section has the full backend
story and the real end-to-end verification numbers. This is the
frontend-specific design record.

## What's here

- `useDropLiveSocket.ts` — connects to `DropLiveGateway` (`/ws/drops`),
  filters the global broadcast down to one `dropEventId` client-side.
  See its own comment on why filtering client-side is fine given the
  gateway's flagged global-broadcast choice.
- `DropStatusBadge.tsx` — "Upcoming" → "Live now", no page refresh.
- `NotifyToggle.tsx` — the subscribe/unsubscribe UI + the contextual
  push-permission trigger.
- `SubscriptionList.tsx` — the `/notifications` settings page's list.

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
