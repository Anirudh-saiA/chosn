# Price comparison page (Day 10)

`/sneakers/[styleCode]/[size]` — reads the Day 9 Market Intelligence
layer plus a new live-but-cheap offer listing, server-rendered, cached
client-side across a size switch.

## Pre-flight

Day 10's brief asked for a check against an installed third-party
design tool before building. That tool wasn't installed — see the
top-level session response for why (untrusted code execution from an
individual's GitHub repo, treated as authoritative instructions). The
substance of the check still ran, by hand:

**Does the brief's inferred language ("dense financial/data comparison
page") match Day 2's actual direction?** Yes, directly — Day 2 already
locked a Vault-surface, zero-radius, hairline-border, mono-figures
system (`packages/config/tailwind-preset.js`) that reads as a data
terminal by construction, not a template retrofitted to look like one.
No mismatch to resolve; the dials (variance 6, motion 4, density 8) are
honored using that existing system rather than a new one.

## Components

- `MarketIntelligenceCard` — current price, signal badge, and a
  divide-x stat row (best available / 30d avg / 90d avg). Density-first:
  no hero whitespace, no product photo (none exist in the catalog yet).
- `OfferTable` — a real `<table>`, one hairline border language, cheapest
  in-stock row gets the page's one primary (Brass) button.
- `SizeSelector` — `rounded-chip`, Day 2's one sanctioned radius
  exception, reused rather than inventing a second.
- `TweenedPrice` — the GSAP number-transition (task 5): tweens only on a
  post-mount value change, never on load; skips the tween entirely under
  `prefers-reduced-motion`.
- `PriceComparisonView` — owns the "which size" client state. Switching
  sizes updates state in place (`history.replaceState`, not a Next.js
  navigation) specifically so `TweenedPrice` stays mounted across a
  switch — a route change would remount it and there'd be nothing to
  tween from. Adjacent sizes prefetch on mount; hover/focus prefetches
  the rest.
- `AffiliateDisclosure` — plain-language, next to the table, not footer.

## A bug fixed along the way

`PriceFigure`'s color mapping was inverted for a shopping price: it tied
green to `deltaPct > 0` (a rise) and red to a fall — correct for a stock
ticker, backwards here, where a falling price is the good news. It had
already shipped that way — `HowItWorks.tsx` passes `deltaPct={-6.0}`
next to a green "Buy" badge, which rendered as a red ▼ beside a green
signal. Fixed in `packages/ui/src/PriceFigure.tsx`: color now follows
favorability (fall = signal green, rise = rust red, matching Badge's
buy/wait meaning); the arrow still tracks the literal numeric sign.

## Post-build audit (task 9's checklist, run by hand)

- **Generic if the logo were swapped?** No — the structure (dense
  divider-grid stats, a real ranked table, terminal-style size chips) is
  functionally motivated, not a decorative shell any brand could wear.
- **One border-radius/shadow language?** Yes. Zero radius / hairline
  border / no shadow everywhere, `rounded-chip` (2px) as the single
  sanctioned exception (Badge, SizeSelector) — nothing new introduced.
- **Motion only where earned?** Yes. The only animation is the price
  tween, firing on a real data change (a size switch), never on mount;
  hover/focus states reuse the site's existing `duration-150 ease-chosn`
  transition, nothing added.
- **Copy check** — one prose em-dash found in `AffiliateDisclosure`
  (stylistic, not structural) and fixed to a period; the page title's
  mixed em-dash/pipe separators were made consistent (`·` internally,
  `|` before the site name).

## Verification (task 10)

Five real launch-catalog variants, checked against the live
`/catalog/:styleCode/:size` endpoint:

| Variant | current | best available | avg30d | signal |
|---|---|---|---|---|
| Dunk Low Panda, UK 8 | ₹8,249 (ajio) | ₹8,249 (ajio) | ₹8,622 | insufficient_data |
| Dunk Low Panda, UK 9 | ₹8,349 (ajio) | ₹8,349 (ajio) | ₹8,722 | insufficient_data |
| AF1 Triple White, UK 8 | ₹8,899 (ajio) | ₹8,799 (myntra) | ₹8,997 | insufficient_data |
| AF1 Triple White, UK 9 | ₹8,999 (ajio) | ₹8,899 (myntra) | ₹9,097 | insufficient_data |
| Samba OG, UK 8 | ₹9,749 (ajio) | ₹9,599 (myntra) | ₹9,848.50 | insufficient_data |

Every `bestAvailablePrice` was cross-checked against the offer table's
own cheapest row independently (two different queries, same catalog
endpoint) and matched exactly in all five cases. `currentPrice` and
`bestAvailablePrice` correctly diverge on AF1 and Samba, where Ajio is
the freshest offer but Myntra is the cheapest — the same real pattern
Day 9's own verification report found, holding up across more variants.
`insufficient_data` on every row is correct, not a bug: the real
dataset is still only hours deep (see Day 9's report), so the 7-day
minimum-history guard is doing exactly its job.

`View Deal` links: all six resolve to the correct real retailer domain
with `target="_blank" rel="nofollow sponsored noopener"`. The product
paths themselves are still fixtures (Day 6/7 — no affiliate credentials
issued yet), so they won't land on a real live listing until those
credentials exist; that's an existing, already-documented pipeline
state, not a defect in this page.

Stale/empty states — tested by temporarily mutating real rows and by a
scratch sneaker/variant with zero mappings (created and deleted in the
same session, cascade-cleaned): "Currently unavailable", "Price data may
be outdated", and "No retailers currently tracked for this size." all
render correctly.

## Lighthouse (local, `next build && next start`, real API + real data)

| Category | Score |
|---|---|
| Performance | 93 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

FCP 1.8s, LCP 3.0s, TBT 90ms, CLS 0.035 — all comfortably within
"good." Best Practices was 96 before two fixes made during this pass: a
CORS-mismatch console error traced to the local test harness (not the
app — the deployed environment's `WEB_ORIGIN` already matches its real
origin) and a favicon that never existed anywhere on the site, added at
`src/app/icon.tsx` using the existing Masthead wordmark colors.
