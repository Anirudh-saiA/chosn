# Frontend: accessibility check (task 4), 2026-10-27

Team: frontend     Branch: team/frontend     Pages: /, /sneakers, a price page (CW2288-111, UK 11), /brands, /login, /wishlist.
Releases, News and Magazine were not checked (they belong to Drops and News now).

## How it was checked
Scripted checks in headless Chrome (1280 wide, dev server), reading each page's accessibility tree and DOM, pressing Tab up to 90 times, measuring text contrast from computed colours, and switching on "reduce motion". No screen reader, real keyboard, or other browser was used.

## Checklist
| Item | Result | Detail |
|---|---|---|
| Every button, link and field has a name | Pass | 0 unnamed of 43, 859, 227, 159, 28, 23 interactive items on the six pages |
| Image alt text, page language, page title, one H1, no skipped heading levels, no duplicate ids | Pass | all six pages |
| Landmarks (header, nav, main, footer) and a "Skip to content" link | Pass | all six pages |
| Pinch-zoom not blocked | Pass | |
| Keyboard order and reach | Pass | Tab starts at "Skip to content", then header, page, footer in a sensible order; the site's own controls all show a focus ring |
| Keyboard trap | Pass (with a caveat) | The script flagged 4 pages as "possible trap"; the repeats were the Tab order wrapping back to the start and the Next.js dev overlay, which does not exist in production. Not re-run on a production build |
| Visible focus on every control | Pass | 0 controls without a ring (the only one was the dev overlay) |
| Reduced motion | Fixed | No looping animation runs. The home hero video kept playing for visitors who ask for reduced motion; now it stops and shows the photo. Verified: 0 videos playing |
| Text contrast (4.5:1, 3:1 for large text) | Partly fixed | See below |

## Contrast: before and after (failing text items)
| Page | Before | After |
|---|---|---|
| Home | 0 | 0 |
| /sneakers | 59 | 9 |
| Price page | 49 | 19 (this includes the "similar sneakers" cards) |
| /brands | 4 | 0 |
| /login | 3 | 0 |
| /wishlist | 4 | 0 |

Fixed: faded sold-out sizes, prices and labels on sneaker cards (were 2.0:1, now at least 4.6:1); the inactive top-bar links (4.3:1, now about 6:1); the small amber labels such as "Browse by brand" (2.7:1, now 4.8:1; this changes the shared `.eyebrow` style); the green "Lowest" pill (4.3:1, now about 6:1).

Still open:
- On a sold-out card the "Sold out" label and the old price are about 2.4:1 because the whole row is also dimmed (opacity-60). Suggest removing the extra dimming and keeping the strike-through.
- A green "Live now" pill on the price page is 2.8:1 (white-ish green on teal). I did not find its source in the time spent; Main or I can trace it next.
- The price page still counts 19 failing items; most are the same sold-out look in the related cards.
- Text over photos and video (hero, covers) is not measured by this script.

## Not checked
Screen readers, Safari/Firefox, real touch devices, forms with errors, the Releases, News and Magazine pages, the sign-up flow, and colour-only cues (for example red/green) beyond what is listed.
