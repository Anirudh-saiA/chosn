# Security scans (Day 16)

## OWASP ZAP — why local, not staging

Task 9 asked for a scan against staging. No staging environment exists
— confirmed in `.github/workflows/ci.yml`'s own comment: Hobby-plan
Vercel, one real URL, which is production. Asked rather than assumed
which target was safe to point an active scanner at; ran locally
against a real production build (`next build && next start`) instead
of hitting real user-facing infrastructure.

**Real constraint hit along the way**: a full active scan
(`zap-full-scan.py`) caused genuine resource contention on this dev
machine — Docker Desktop's own engine API started failing outright
(10 pre-existing unrelated containers were already running here), and
Postgres briefly became unreachable. The API process itself stayed up
throughout (Day 11's `pool.on('error')` fix doing its job under real,
unplanned stress, not just the test that originally justified it), and
no data was lost — confirmed directly (`SELECT count(*) FROM sneakers`
after recovery). Switched to `zap-baseline.py` (passive-only spidering,
no active attack payloads) — lighter, and still a real automated scan
of the actual auth flows, page structure, and headers.

## Findings and fixes

First baseline run, before any header changes: 9 alerts, 2 Medium
(`Missing Anti-clickjacking Header`, `CSP Header Not Set`), 6 Low, 1
Informational.

Fixed via `apps/web/next.config.mjs`'s `headers()` — see that file's
own comments for the reasoning behind each specific value, not repeated
here:

- **CSP** — a real policy now exists (`default-src 'self'`, explicit
  `connect-src` covering the API origin + WebSocket + PostHog, `img-src`
  allowing `data:` for the TOTP QR code, `frame-ancestors 'none'`).
  **Honest limitation, not silently accepted**: `script-src`/`style-src`
  use `'unsafe-inline'` rather than a nonce, because Next.js's
  documented nonce pattern requires forcing every page that uses it
  into fully dynamic rendering — which would undo Day 11's and Day 15's
  actual, measured ISR/SSG performance work across most of this app's
  real traffic. Re-scanning after this fix shows exactly that tradeoff:
  the original "CSP Header Not Set" finding is gone, replaced by two
  *different* Medium findings (`CSP: script-src unsafe-inline`,
  `CSP: style-src unsafe-inline`) — not a net reduction in Medium-
  severity count, a different, disclosed one. Revisit if a real XSS
  finding ever surfaces that a nonce specifically would have stopped.
- **X-Frame-Options: DENY** — fully resolves the other Medium finding
  (confirmed gone on re-scan, not replaced by anything).
- **X-Content-Type-Options**, **Permissions-Policy**,
  **Cross-Origin-Resource-Policy** — the Low findings, all resolved
  cleanly (confirmed PASS on re-scan).
- **X-Powered-By removed** (`poweredByHeader: false`) — resolves the
  "Server Leaks Information" Low finding.
- **Cross-Origin-Opener-Policy** — went through two iterations, both
  scanned for real: `same-origin-allow-popups` first (a defensive
  guess for a hypothetical popup-based OAuth flow that doesn't exist in
  this codebase), which ZAP itself flagged as "less secured" on re-scan
  — corrected to the strict `same-origin` after checking the actual
  `signIn('google', ...)` call in `LoginForm.tsx` (a full top-level
  redirect, not `window.open()`), confirmed resolved on the next
  re-scan.
- **Cross-Origin-Embedder-Policy — deliberately left unset**, despite
  being flagged (Low). COEP's `require-corp` value would require every
  cross-origin resource this app loads (PostHog's beacon calls,
  Google's OAuth redirect chain) to send back a matching CORP/CORS
  header from origins this service doesn't control, for a form of
  cross-origin isolation this app has no actual use for (no
  SharedArrayBuffer, no precise timers). The realistic downside of
  guessing wrong is silently broken analytics or a broken login — worse
  than the header's own protection is worth here. A reasoned skip, not
  an oversight.

**Reviewed, not fixed, because they're not real issues**:
`Information Disclosure - Sensitive Information in URL` — the one
instance is ZAP's own spider synthetically appending
`?email=zaproxy@example.com` to the homepage as a generic parameter-
fuzzing probe; nothing in this app reads or exposes an email via a URL
parameter anywhere in the real page flow (checked the actual alert
instance and its `evidence` field before dismissing it, not assumed).
`Modern Web Application` and the two `*-Storable Content` findings are
Informational classification notes about `robots.txt`/`sitemap.xml`
(neither of which exists yet — a separate, non-security gap) and
`_next/static` cache headers, not vulnerabilities.

## Final state

`zap-baseline-final.{html,json}` in this directory — the actual last
scan run against the fully-patched build. **7 alerts**: 2 Medium (the
disclosed `unsafe-inline` tradeoff above), 1 Low (the deliberately-
skipped COEP), 4 Informational (reviewed, not real issues). Down from
9 alerts / 2 Medium+6 Low+1 Info originally — a real reduction, honestly
reported as a different mix rather than a clean "all fixed."
