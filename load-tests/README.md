# Load tests (Day 11)

Artillery, not k6 — both are permitted by the brief; Artillery was the
one that installed and ran cleanly via `npx` in this environment
without a separate binary/PATH setup.

## Running

```
npx artillery run load-tests/price-page.yml --target http://localhost:3001
npx artillery run load-tests/search.yml --target http://localhost:4001

# cache-miss-burst.yml needs its target key flushed immediately before
# the run -- otherwise it just measures a warm cache, not the fallback
# path it exists to test:
docker exec chosn-redis-1 redis-cli DEL "mi:v1:<the DD1391-100 UK-8 variant id>"
npx artillery run load-tests/cache-miss-burst.yml --target http://localhost:4001
```

Get the variant id for the DEL command from
`GET /catalog/DD1391-100/8` -> `variant.id`, or from `market_summaries`.

## What each one models

- **price-page.yml** — the Day 10 page itself, three real variants,
  ramping to ~80 arrivals/sec sustained. This exercises the full stack
  including Next's own ISR page cache, not just the API.
- **search.yml** — the Day 11 `/catalog/search` endpoint directly, a mix
  of prefix (mid-type), whole-word, brand-filter, signal-filter, and
  browse-all queries at the same ramp.
- **cache-miss-burst.yml** — no ramp, a single 100/sec burst against one
  URL whose Redis key was just deleted, modeling "many users land on a
  page the instant its cache expires" — the scenario most likely to
  cause a real incident, per the brief.

`ensure.p95` / `ensure.maxErrorRate` are checked by Artillery itself and
fail the run (non-zero exit) if breached — see `run-report.md` for the
actual numbers from this pass and what got fixed.
