# Offers bank (stores and brands we do not scrape)

Used by `scripts/social_posts.py` for the "offer" slot, and as a fallback when our own sale data is stale. Rules:
- Only an offer stated on the brand's or store's own page counts. Coupon and deal sites (GrabOn, DesiDime, CouponCabin and the like) list codes and dates that conflict and go stale; we never repeat them as facts.
- Every item carries `checked:` (the day someone read the page). The script uses an item only if it was checked within 3 days of the post day, because offers end without notice.
- The post says it is not in our price data, gives the date it was read, and tells the reader to check the terms.
- Re-check the page the day it goes out, update `checked:`, and only then post. Words and numbers are quoted exactly as the page states them.
- No claims about a brand that shows no offer: on 2 Nov Main found no sale banner on nike.in, only a "Diwali Essentials" collection with no discount on in.puma.com, no offer text on asics.co.in, and newbalance.co.in did not load. None of those four gets a post.

Format: `@item <id> | <confidence>`, `checked:`, `text:`, `sources:` (links separated by ` ; `).

@item adidas-diwali-2026-11 | Confirmed
checked: 2026-11-02
text: Offer on adidas India's own site, not in our price data: its banner reads "DIWALI SALE - BUY 2, GET 60% OFF*" (read 2 Nov). The asterisk means terms apply, and they are on adidas's site. Check them before you buy two. adidas.co.in
sources: https://www.adidas.co.in/

## Retired
- `adidas-eoss-2026-11` ("End of Season Sale, Buy 2 Get Flat 50% Off"): no longer on adidas.co.in's homepage on 2 Nov; replaced by the Diwali banner above. Do not post it.
- `festive-watch-2026-11`: withdrawn; it made claims about Nike India and Puma India that Main's reading of their pages does not support.
