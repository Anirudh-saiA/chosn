# Tasks: frontend

Owner: the frontend team. Main assigns; the team updates this file and reports each evening with /team-report frontend.
First assigned 2026-10-21.

## Open
1. **Baseline and walk-through.** From a clean branch, run `npx tsc --noEmit` and `npx eslint apps/web/src`. Then open each key page at desktop and 375px and list what is broken or ugly: `/`, `/sneakers`, a sneaker price page, `/releases?tab=drops` (calendar, day view, drop cards, Just landed), `/releases?tab=news` (newspaper front page, filters, new-stories banner), `/drops/mine`, `/magazine` and the reader `/magazine/<today>`. *Done when:* a numbered list with severity and a screenshot or exact description for each, in your report.
2. **Mobile pass, Releases and the magazine reader (375px).** Calendar day buttons tap-sized, the day view cards, the News front page columns, the reader controls and the page-turn on touch. Fix what is wrong. *Done when:* no sideways scroll, tap targets at least 44px, checked in the browser at 375px.
3. **Magazine page fit.** Check every page type with long and short headlines and with missing pictures: cover, editor's letter, contents (9 items), feature, top stories, drops (4 rows), photos, in brief, notes. Nothing may be cut off at the page edge or overlap the page number, and the PDF (`/magazine/<slug>/print`) must match the screen. *Done when:* each page type verified and fixes listed.
4. **Accessibility on the new UI.** Keyboard operation (calendar days, reader arrows, buttons), visible focus, labels, colour contrast of red and yellow on paper, reduced motion. *Done when:* a short checklist with pass/fail per item and fixes.

## Doing

## Done
