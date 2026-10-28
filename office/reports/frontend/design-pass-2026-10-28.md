# Front end: design polish pass, 2026-10-28

Branch `team/frontend-3` (worktree agent-ad1225628d9d1027b, based on develop c03d931). Not pushed. All changes are in `apps/web`.
Screenshots: `office/screenshots/design-pass-2026-10-28/` (`before-*` and `after-*`, widths 375 / 768 / 1280; budget tabs `after-budget-<band>-<width>.png`; modal `after-modal-search-<width>.png`).

## What changed

**Brand rules (black and white, Inter, no gradients, rupees)**
- Re-pointed the old navy / violet / ice / chalk tokens to neutral black, white and greys in `apps/web/tailwind.config.ts` (same token names, so every existing class follows). Kept accents: amber #9A5A00, green #0A6B44, brown #7A4B00, rust (errors) #B3261E. Pale yellow stays only on the "Best available" figure (now a pale-yellow pill with black text; the old yellow text on white was unreadable).
- One font: Inter (layout.tsx). Anton, Cormorant, Manrope, JetBrains Mono and Caveat are gone; the old font variables are aliases of Inter. Headings are Inter bold, sentence case, tight tracking (the old condensed all-caps sizes overflowed at 375, for example "COMPARE." and "01 COMPARE" were cut off).
- Gradients removed: aurora, grid, grain, glass, hud-card, edge-glow, gradient text, button shine, skeleton shimmer, brass/signal gradient fills (now flat), shoe-colour glows, page ambient, loader backdrop, 404 glow, global-error page, landing wheel tiles. Kept on purpose: dark scrims over photos and video (legibility only: hero video, subscribe band, post captions), and the magazine reader (Drops and News desk lane).
- Navy, light-blue page wash and marker yellow replaced by #0A0A0A / white / grey. The yellow scroll highlight is now light grey. Calendar drop days are black circles with a small amber count.
- Orange hero tagline is now white. Red Magazine tab and "new stories" button are black/white.

**Rounded edges (founder add-on)**
- Radius tokens in `globals.css`: --radius-sm 10, -md 16, -lg 20, -xl 24, -2xl 28, -pill 999. Same scale in `tailwind.config.ts`. Root cause found: the shared preset only defined none/DEFAULT/chip/full, so every `rounded-xl`, `rounded-2xl` etc. in components rendered as square. They now work.
- Global defaults (zero specificity) for buttons, inputs, dialogs, menus, tabs, cards, images in cards. A scripted sweep added a radius to 84 square bordered boxes and icon tiles (forms, community, admin, legal, pricing, drops). Tabs and filters are pills; footer is a black panel with rounded top corners; cookie banner and search palette (28px) are rounded windows.
- Fixed a regression I caused: a pill radius on the full-bleed Releases gate buttons made ovals; gate and scrim buttons are `rounded-none`.

**Pages**
- Footer rebuilt: wordmark, three labelled columns, every link 44px tall, small print kept verbatim. (Old one: large uppercase links overlapping an orange outline wordmark.)
- Price page: pale-yellow Best available pill, flat amber selected size, 44px chips.
- News: category filters are single-row scrollable pills (they wrapped inside a rounded box), 44px "Compare prices" chips, black "read as a magazine" button.
- Releases: tabs are 44px pills, headings sized for 375, "Add every drop to your calendar" no longer wraps into capitals.
- Cookie banner: readable link (was yellow on white), rounded card.
- Tap targets raised from 34-40px to 44px: filters, selects, calendar arrows and days, My drops links, drop follow, compare toggle, report buttons.
- Budget shelf (Drops tab): skeleton rows while loading instead of one line of text, rounded card and tabs, "Compare all stores" no longer breaks across lines, local Inter font load removed (now global).

**Loading and error states (none existed)**
- New `loading.tsx` for `/sneakers`, `/releases` and the price page (skeletons in the real page frame), shared `components/ui/Skeletons.tsx`.
- New `app/error.tsx` (route error keeps header and footer). `global-error.tsx` and `not-found.tsx` restyled black and white.

## Budget tabs (Drops), checked by eye at 375 and 1280
- 5k, 10k, 15k, 20k all load, 10 rows each, rupees, store, coupons/offers as published, Buy button, no overflow.
- **Finding for Back end / Main:** the 10k, 15k and 20k tabs show the same ten pairs (₹5,399 to ₹8,199) because ranking is "sold at the most stores" and every popular pair costs under ₹10,000. The tabs look identical. A band-only filter (for example 10k-15k) or a different ranking is a Back end / founder decision; I did not change it.

## Checks run
- `npx tsc --noEmit` clean; `npx eslint src --max-warnings=0` clean.
- `next build --webpack`: compiles, then fails while prerendering `/sneakers/[styleCode]/[size]` because the local API returned HTTP 500 for several `catalog` calls under the build's load. Not caused by this change and I did not retry against the shared API. Needs a build against a quiet API or CI.
- Automated check at 375, 768, 1280 on home, sneakers, price, Releases gate, Drops, News, 404 plus 14 other pages at 375 (community, terms, privacy, login, sign-up, stores, brands, price drops, transparency, magazine, compare, wishlist, feedback, times): no sideways scroll anywhere, all images have alt.
- Dev server: webpack mode on port 3010 (Turbopack cannot follow the node_modules junction into this worktree); stopped when done. Screenshots use headless Chrome with web security off only because the API allows CORS for localhost:3000 alone.

## Not verified / open
- Real phones and Safari (iOS rubber-banding, 100svh, backdrop and font rendering). Only headless Chrome with device emulation.
- Dark mode, high-contrast mode, reduced-motion visual check (rules exist, not exercised).
- Tap targets: sneaker card size chips, colour swatches and photo arrows are 24-30px visible, with invisible 44px hit areas from the previous team (the automated audit still lists them). Not re-tested with a finger.
- Pages I only checked at 375: community, terms, privacy, login, sign-up, stores, brands, price drops, transparency, compare, wishlist, feedback. Signed-in pages, admin and community post views not checked.
- Magazine reader and printed PDF untouched (still red/yellow, Playfair-era design): Drops and News desk owns it.
- Missing "before" shots: Drops budget block and modal (the budget call failed in my first before run on CORS, and I did not rebuild the old code for a before modal). Before shots of cards and buttons are the sneakers, price and drops files.
- `/sneakers/<styleCode>` without a size returns 404 (only `/sneakers/<styleCode>/<size>` exists); a redirect to a default size would be friendlier. Back end or Main decision.
- Price page shows "Current price" ₹16,199 at a marketplace next to "Best available" ₹6,371 and "Now +148%": honest but confusing; the logic belongs to Back end / Data.
- `packages/ui` (outside my lane) still defines the primary button as a brass gradient; I override it in `globals.css`. Better fixed at the source by Main. Its secondary button also has `hover:text-white` on a white background, overridden the same way.
- Slow: `/releases?tab=drops` took more than 7 s to render in dev (skeleton shown). Production not measured.

Commits: baaf13b, ef1ba7b, plus the final commit on this branch.
