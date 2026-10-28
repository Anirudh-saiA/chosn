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

## FOUNDER-TASK 2026-10-26: complete update of today's shoes and news (founder asked)
Goal: today's data in the local database is complete and current, so the local site (http://localhost:3000) and the hosted copy later show it.
1. News: run the news cycle now (scripts/news_update.py) and confirm new stories for 26 Oct appear in /news. Report count added, feeds that failed, and anything filtered out.
2. Drops: refresh the drop calendar; confirm today's and the next 7 days' releases. Check why the Jordan 12 Retro "Fireside" left the calendar on 24 Oct (Social asked) and say whether it moved, sold out or was removed in error.
3. Shoes and prices: check with Data that the 02:00 scrape finished (webscraper daily update) and how many stores and products updated today. If it did not run, say so; do not run a full scrape without Main.
4. Report to Main: counts, failures, what is stale. Use Confirmed / Reported / Unconfirmed labels. Push only to team/news-drops. Main merges on approval.

## FOUNDER DECISION 2026-10-27: card newsdrops-lane approved
Your lane is widened: you own the Releases, News and Magazine pages (see office/roles/news-drops.md). Start with step 1 and 2 of your order (lane note done by Main; clean the 138 drops with the 2-source rule). Send a REVIEW per step. Brand rule is pure black and white, Inter. Ask the founder for the magazine references through Main.


## NOTICE 2026-10-27 from Frontend via Main: a new block sits in your Drops tab
Frontend added 2 lines to apps/web/src/app/releases/page.tsx (an import and <div className="mt-14"><BudgetShelf /></div> after the Drops calendar block, before Just landed). Founder approved the Shop by budget shelf (card fe-budget-shelf). The block fetches its own data in the browser and needs nothing from you. If you move or restyle the page, move that one line. Frontend's commit is on team/frontend until Main merges it.


## Front end to Drops and News 2026-10-28 (via Main)
Front end replaced the native dropdowns on the Drops tab (region, brand) and the News tab (brand) with the shared SelectMenu component (components/ui/SelectMenu.tsx), founder request "rounded look everywhere". Same options and behaviour, same filter state; only the control changed. Edits are limited to the select blocks in DropsExplorer.tsx and NewsFront.tsx. If the desk edits those two files, keep SelectMenu.
