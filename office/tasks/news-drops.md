# Tasks: news-drops

Owner: the news-drops team. Main assigns; the team updates this file and reports each evening with /team-report news-drops.
First assigned 2026-10-21.

## Open
1. **Feed health after the clean-up.** The celebrity and fashion lane was removed and three general feeds were tightened to footwear-only headlines. Over the next day, check which feeds return stories, which return nothing, and whether anything off-topic still appears (sneakers and drops only). Tune filters; propose new sneaker sources that robots.txt allows. *Done when:* a table per feed (stories in 24h, off-topic count) and any changes made.
2. **Review today's issue of The CHOSN Times** (`/magazine/2026-10-21`): is the cover story right, are the drops correct and in rupees with honest confirmation levels, are there off-topic or duplicate stories, are pictures matched to their story? Fix content problems in the builder; send look-and-feel problems to Front end. *Done when:* a review with what you changed.
3. **Drop calendar quality.** About 144 upcoming drops: check duplicates, stale "Live" entries, missing pictures, and drops with no source. Run `maintain-drops` and report the numbers before and after. *Done when:* counts and what was fixed.

## Doing
- Waiting for review of team/news-drops (feed filters, SEC-8, PDF skip).

## Done
- 2026-10-23: SEC-8 mail-sender check with tests (task from 2026-10-22 brief).
- 2026-10-23: Feed health table, off-topic filters tightened, `--dry` flag; drop-calendar numbers; issue 2026-10-23 checked. See office/reports/news-drops/2026-10-23.md.
- Still open: propose new sneaker sources that robots.txt allows (not done); two drops missing pictures (data, needs fetch_drop_images run).
