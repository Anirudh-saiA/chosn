# Product images (Day 37)

## What actually needed building vs. what already existed

The canonical image field (`sneakers.primary_image_url`) and its
resolution/placeholder pipeline **already existed** before today — Day
1's canonical schema, already flowing through `catalog.service.ts`,
`drops.service.ts`, and every frontend consumer, with an already-real
placeholder (`SneakerPlaceholderArt.tsx`, a deliberate typographic
treatment, not a stopgap — kept, not replaced, see its own doc comment
and the note below). What genuinely didn't exist:

1. **Per-retailer listing images** — no adapter, no schema column,
   anywhere. Added: `price_snapshots.image_url` /
   `manual_price_entries.image_url` (migration
   `0018_price_snapshot_image_url.sql`), populated by all 6 retailer
   adapters' `parse()`/`fetchPrice()` steps.
2. **A shared resolution function** — each frontend consumer had its
   own ad hoc `primaryImageUrl ? <img> : <placeholder>` check (or, in
   `SneakerCard.tsx`'s case, a *different*, inconsistent placeholder —
   raw style-code text instead of the typographic brand/model
   treatment used everywhere else). Now: `lib/resolve-sneaker-image.ts`,
   one function, used by the price comparison page (the only surface
   with real per-offer data, so the only one where the retailer-fallback
   tier can actually trigger), the search/browse grid, drop cards, the
   drop detail page, and the community composer's sneaker search
   results.
3. **The price comparison page had no image at all** — genuinely
   missing, not degraded; added one.
4. **A curation endpoint** — `POST /admin/catalog/:styleCode/image`
   (admin-guarded), the whole curation workflow for now. A dedicated
   `/admin` UI page is a fine upgrade later; one endpoint is what task 4
   actually asked for ("a basic admin form... or a seed script").

## Why nothing is curated yet

Deliberately, not an oversight. Populating `primary_image_url` for even
one real model means a real, publicly-reachable image URL — and every
option available today carries a real risk this project has taken
seriously elsewhere (Day 26's hero photo was explicitly "a real
*licensed*" image, not a convenient hotlink):

- Hotlinking a brand's or retailer's own product photo is very likely
  to break (hotlink protection is common) or raise a real ToS/licensing
  question this session isn't positioned to clear on the account
  holder's behalf.
- A generic stock-photo service isn't "this exact colorway's real
  photo" — it would be quietly wrong in a way a user could catch,
  which is exactly the kind of confidently-wrong presentation this
  project has avoided everywhere else (see the fixture-mode price
  disclosure work, Day 20).

So: the mechanism is real and ready (`POST /admin/catalog/:styleCode/image`
accepts any real, licensed HTTPS image URL you provide), but no URLs
are inserted by this change. Same category of decision as Cloudflare
R2 — infrastructure built, real-world sourcing left to whoever owns
that call.

## Curation priority (manual judgment, not data-driven)

Task 5's ask — real PostHog page-view data — doesn't exist yet to base
this on (dashboards were never configured; the only real events on
record are ~14 from one manual test session, not real traffic; see Day
34/36). This list is a manual judgment call, flagged as exactly that,
not a data-backed ranking:

Most broadly recognizable models in the current 28-model catalog, the
ones most likely to be a new visitor's first impression of the site —
recommended as the first curation batch once real image URLs exist:

1. Nike Dunk Low "Panda" (`DD1391-100`) — the single most search-common silhouette in the catalog
2. Air Jordan 1 "Chicago Lost & Found" (`DZ5485-612`) — most recognizable Jordan colorway
3. Nike Air Force 1 '07 "Triple White" (`CW2288-111`) — the most universally-known sneaker, period
4. adidas Samba OG (`B75806`) — currently the highest cultural-relevance non-Nike model in catalog
5. adidas Yeezy Boost 350 V2 "Zebra" (`CP9654`) — most recognizable colorway of the line

Re-derive this list for real once PostHog has several days of organic
traffic (Day 29/36's own repeated point) — replace it, don't just
supplement it, the way every other "data doesn't exist yet, here's a
manual placeholder" decision in this project has been handled.

## Backfill (task 7)

Nothing to backfill. Every adapter's fixture data has always returned
`imageUrl: null` — see `RawRetailerOffer.imageUrl`'s own comment on why
(no fixture invents a photo no real listing has). Once a source's real
credentials exist and it starts reporting real image URLs, those flow
in automatically on the very next fetch cycle — there's no separate
backfill step needed the way Day 28's catalog expansion needed one for
prices.

## A real bug this found: CSP silently blocked every image

The very first real curated image (`DD1391-100`, a real Nike.in-sourced
photo — see the curation script's own history) rendered as a broken
image icon on the live site despite the API correctly returning the
URL. Cause: `next.config.mjs`'s Content-Security-Policy had `img-src
'self' data:` — no external image host was ever allowed, so the browser
silently refused to load it. Nothing in local verification caught this
(a curl check confirms the URL is *reachable*; it says nothing about
whether the *page* is allowed to load it — that only shows up by
actually looking at a rendered page, which is exactly how this was
found). Fixed: `img-src` now allows any `https:` origin, since the
retailer-fallback tier can point at any of 6+ different CDNs and a
curated canonical image can come from wherever its real license
actually lives — there's no fixed, enumerable allowlist the way
`connect-src`'s API/PostHog/Sentry origins have.
