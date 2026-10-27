# Dependency triage, 2026-10-22

Run from the repo root on team/security (ea31a7d + findings). The repo is one npm workspace with one lockfile, so `apps/api` and `apps/web` have no audits of their own; the root audit covers both. `npm audit` total: 30 (1 low, 12 moderate, 15 high, 2 critical); production only: 16. Nothing was upgraded or installed by Security.

## Real risk: fix before a public host
| Package | Used by | Advisory | Reachable? | Fix |
|---|---|---|---|---|
| proxy-addr (critical) | api, via Express | IP spoofing via IPv4-mapped IPv6 trust subnet | Yes: `trust proxy` is set and the rate limiters key on `req.ip` | proxy-addr >= 2.0.8 (update express / lockfile) |
| next 16.3.4 (critical) | web | RCE in `next/og` ImageResponse; cache poisoning of SSG/ISR when self-hosted | Not today: no ImageResponse / next/og use in `apps/web/src`. Self-host cache issue matters if we host ourselves | patched 16.3.x (>= 16.3.8 covers the other advisories listed) |
| multer + @nestjs/platform-express (high) | api upload routes | DoS via crafted multipart field names and aborted uploads | Yes, but only on logged-in, rate-limited upload routes | multer >= 2.3.0 via platform-express update |
| file-type (moderate, direct) | api `post-images.service.ts` | infinite loop in ASF parser on malformed input | Yes for logged-in users: the sniff runs on the raw upload before any rejection | file-type 22.x fix (flagged as a major bump) |
| nodemailer (high) | web (next-auth / @auth/core) | `raw` option bypasses disableFileAccess/disableUrlAccess: file read / SSRF in a message | Only if we pass user-controlled `raw`/content to sendMail; we do not seem to. Confirm with Back end | next-auth/@auth/core update when a fix exists; no fix yet |

## Real but low: fix in the normal upgrade
- sharp < 0.35.5 (high): librsvg CVE. Uploads allow only JPEG/PNG/WebP (checked in code), so SVG never reaches sharp. Upgrade anyway.
- exceljs / uuid (moderate): used for the waitlist sheet export, admin data only.
- fast-uri, brace-expansion, source-map-js, braces, micromatch, fast-glob, chokidar, postcss-selector-parser: build-time or regex DoS on trusted input.

## Noise (dev tools only, do not ship)
vite / launch-editor, vitest and @vitest/mocker, esbuild and @esbuild-kit (drizzle-kit), tailwindcss chain. The audit's "fix" for tailwindcss and drizzle-kit suggests a major or even older version; do not follow it blindly, upgrade on a branch with tests.

## The new packages
- **imapflow 2.8.0 and mailparser 3.12.2** (both by one maintainer, Andris Reinman, same author as nodemailer; both updated this week; no advisories). Used only by `apps/api/src/scripts/fetch-email-news.ts`, a script that reads one mailbox. Findings SEC-8 below. The output is https-only links and tag-stripped text; nothing is rendered as HTML.
- **page-flip 2.0.7**: last release May 2022, single maintainer, no advisories. Used in `MagazineReader.tsx` with cloned React-rendered DOM nodes, never an HTML string, so no injection path. Maintenance risk only (info).
