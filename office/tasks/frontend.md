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

## FOUNDER-TASK 2026-10-27: why does the hero page lag?
The founder sees lag on the hero (home) page. Find the cause and tell Main. Repo: D:\CHOSN\chosn (develop), web app apps/web. Run it locally (API localhost:4000, web localhost:3000 with COMING_SOON=off) and measure: slow loading, slow scroll, jank on animation, large images, heavy JavaScript, slow API calls. Also check the Next.js dev server (dev mode is slower than production; test a production build too).
Report to Main as REVIEW: the cause (Confirmed or Unconfirmed), numbers (for example load time, image sizes, long tasks), and the smallest fix. Write it to office/reports/frontend-hero-lag-2026-10-27.md. Do not change code until Main shows the fix as a card and the founder approves.

## FOUNDER-TASK 2026-10-27 (second): lots of front-end design work coming
The founder says we will work on the front end a lot, on multiple designs. Be ready: worktree on D:, up to date with develop, app builds and runs against the local API. One REVIEW per design (before/after screenshots at phone and desktop width; brand rules: pure black and white, Inter, rupees). Main shows each as a card; nothing merged or pushed before approval. Send Main everything found so far (hero-lag report and any design proposals) as REVIEW. Do not touch the Releases, News and Magazine pages: a founder card (newsdrops-lane) may give them to Drops and News.


## FOUNDER DECISIONS 2026-10-27 (cards approved by the founder)
- fe-brand-rules: PURE BLACK AND WHITE, Inter, no gradients (his earlier brief). The navy, yellow and Playfair rule in your role brief is replaced; Main updates office/roles/frontend.md.
- fe-priorities: hero lag fix first, then the phone pass (tap targets, analytics banner), then new designs.
- fe-hero-lag: APPROVED. Play the community and waitlist videos only when scrolled into view; remove the grain layer or make it screen-sized without a blend mode. Branch team/frontend, before/after numbers, send Main a REVIEW. Not merged or pushed before Main merges.
- Releases, News and Magazine pages: card newsdrops-lane approved: Drops and News owns them (see office/roles/news-drops.md). Do not edit those pages.
- Founder still owes: which device and browser lags, the design list in order with references.


## FOUNDER-TASK 2026-10-27: categories Popular, Under 5k, 10k, 15k, 20k
The founder said: "lets make categories like popular, under 5k, 10k and 15k and 20k". Build on the Shop by budget shelf (card fe-budget-shelf): add a first category tab "Popular" next to Under Rs 5,000 / 10,000 / 15,000 / 20,000, so the tabs read Popular, Under 5k, 10k, 15k, 20k.
Popular = the shoes sold at the most stores (the existing sort=stores in the search API), only shoes with 2 or more stores (a comparison needs at least 2; the founder is deciding whether retail stores only or all stores count, so keep the rule in one place and easy to change). Show the same row as the budget tabs (picture, name, price, cheapest store, coupons and offers as published). Pure black and white, Inter. One REVIEW with screenshots at phone and desktop. Back end: if Popular needs its own call, send a REVIEW; do not add it without a card.

## Main to Frontend 2026-10-28: Back end's one-call endpoint is in develop (e1895b1)
GET /catalog/budget?max=5000&limit=12[&sort=popular] returns per shoe the cheapest eligible offer with offers[] and storeCount, 0.3 to 0.7 s. Switch the shelf to it, take phone and desktop screenshots in the real Drops tab, send the REVIEW. Main then merges your placement 408dbf2 and Popular 5b14bff.
