# Security -> Drops and News desk: news feed time and size limits (founder approved 2026-10-27)

`SEC-11-news-fetch-limits.patch` (SEC-11 item 10). `fetch-news-feeds.ts` fetched every feed and its `robots.txt` with no timeout and no size cap, so one stalled feed blocked the rest of the run and a huge response was read fully into memory.

The patch adds `apps/api/src/scripts/limited-fetch.ts` (`fetchLimited`: 20 s timeout, 3 MB cap, 500 KB for robots.txt; throws on timeout or oversize, returns `{ ok, status, text }`) and uses it for both fetches in `fetch-news-feeds.ts`. A failing feed is reported in the run report and skipped, as before. Four tests in `limited-fetch.spec.ts` use a throwaway local server (normal page, 404, oversize, never-ending response).

Apply: `git apply --check handoff/security-news-drops/SEC-11-news-fetch-limits.patch` then `git apply` (add `--ignore-whitespace` if line endings complain). Checked in a scratch copy: `tsc --noEmit` clean, eslint clean on `src/scripts`, 30 tests pass in `src/scripts` and `src/drops/news*`. Not run: a live feed fetch (to avoid extra load on the sites).

Same pattern, not changed here: `fetch-official-news.ts` lines 119 and 158 (SEC and YouTube calls) also have no timeout; switch them to `fetchLimited` too.
