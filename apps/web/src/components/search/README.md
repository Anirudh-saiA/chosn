# Search & browse (Day 11)

`/sneakers` — the entry point the landing page's "compare prices"
promise was missing. Reachable from the header nav on every page now
that it's a real, complete route (Masthead deliberately had no nav
links before this — see its own doc comment).

## Design decisions

- **VISUAL_DENSITY 5-6/10** here vs. the price page's 8/10 — generous
  card padding (`p-6`), a real grid gap (`gap-6`), room to scan one card
  at a time. Still zero-radius/hairline-border, same as everywhere else
  on the site — density changed, the brand's one border/radius language
  didn't.
- **MOTION_INTENSITY 3-4/10** — no entrance/scroll animation on grid
  items, at all. The only interactive state is the existing
  border-color hover already used elsewhere (`hover:border-moss`), and
  the debounced search input, which has no animation of its own.
- Filtering is entirely **query-param-driven** (`?q=&brand=&signal=`) —
  a real Next.js navigation on every filter change, not a client-side
  filter of an already-fetched dataset. Text input is debounced (300ms);
  brand/signal chips apply immediately since they're discrete clicks,
  not typing.

## Search backend

Postgres `tsvector`/GIN, not a dedicated search service — see
`apps/api/drizzle/0005_sneaker_search.sql` for the full reasoning.
Two things worth knowing if extending this:

- **Prefix matching** (`buildPrefixTsQuery` in `catalog.service.ts`)
  turns "nik" into `nik:*` so query-as-you-type matches mid-word, not
  just on a completed token.
- **Slash-separated colorways** ("White/Black") tokenize as one
  indivisible lexeme in Postgres's default parser — confirmed by
  actually running `q=black` before the fix and getting zero matches
  for a sneaker literally named "White/Black (Panda)". Fixed by
  `replace(colorway, '/', ' ')` before indexing.

## Cards pull from the cache, not one Redis call each

`CatalogService.search()` joins `sneakers` → each sneaker's lowest-size
variant → that variant's `market_summaries` row in one query, rather
than N calls to `MarketIntelligenceService.getCached()` for N cards.
Both approaches avoid live aggregation (task 2's actual requirement);
the join avoids N round trips for what would otherwise be N Redis
calls issued serially per page load — the more naive implementation,
not the more correct one.

## "Default size"

Each sneaker's lowest listed size — a documented, deterministic choice,
not an arbitrary one. There's no real popularity signal to rank by yet
at 5-10 launch-catalog models; swap for actual order/interest data once
it exists.

## Verification

- Prefix search (`nik`), whole-word (`dunk`, `air`), a slash-colorway
  search (`black` → both "White/Black" and "Core Black" sneakers), brand
  filter, signal filter, browse-all, and the zero-results state — all
  checked against the live endpoint with real launch-catalog data.
- Empty state confirmed for both "no matches for this query" and "no
  matches for these filters" (all 5 sneakers are currently
  `insufficient_data`, so `signal=good_time_to_buy` correctly returns
  zero and shows the empty state, not a silent blank grid).
- Nav link confirmed present and correct on both `/` and `/sneakers`.
- Card click-through confirmed landing on the correct default-size price
  page (`/sneakers/DD1391-100/8`, etc.).

## Lighthouse (local, real data)

Performance 96 / Accessibility 100 / Best Practices 100 / SEO 90.

One real accessibility finding, fixed: cards used `<h3>` with no `<h2>`
anywhere on the page — an `<h1>` → `<h3>` skip, flagged by the
`heading-order` audit. Changed to `<h2>` (each card is a distinct item
in the page's one list, not a subsection three levels deep).

One SEO finding investigated and not fixed, because it isn't real: the
`meta-description` audit fails consistently across three separate
Lighthouse runs, but `curl`ing the page directly (twice, independently)
shows a correctly-formed, non-empty `<meta name="description">` tag in
the actual served HTML — the same thing a real search crawler parses.
Reported as a likely Lighthouse/local-headless-Chrome artifact specific
to this test harness rather than presented as fixed when there's
nothing in the served markup to fix.
