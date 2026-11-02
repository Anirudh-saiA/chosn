# Offers bank (stores and brands we do not scrape)

Used by `scripts/social_posts.py` for the "offer" slot, and as a fallback when our own sale data is stale. Rules:
- Only an offer stated on the brand's or store's own page counts. Coupon and deal sites (GrabOn, DesiDime, CouponCabin and the like) list codes and dates that conflict and go stale; we never repeat them as facts.
- Every item carries `checked:` (the day someone read the page). The script uses an item only if it was checked within 3 days of the post day, because offers end without notice.
- The post says it is not in our price data, gives the date it was read, and tells the reader to check the terms.
- Re-check the page, update `checked:`, and only then post. Prices and percentages are quoted exactly as the page states them.

Format: `@item <id> | <confidence>`, `checked:`, `text:`, `sources:` (links separated by ` ; `).

@item adidas-eoss-2026-11 | Reported
checked: 2026-11-02
text: Offer on adidas India's own site, not in our price data: its End of Season Sale says "Buy 2 Get Flat 50% Off" on shoes, apparel and accessories (read 2 Nov). Single pairs are marked down by less. Check the terms on the page before you buy two. adidas.co.in/eoss-shoes
sources: https://www.adidas.co.in/eoss-shoes ; https://www.adidas.co.in/eoss

@item festive-watch-2026-11 | Reported
checked: 2026-11-02
text: Festive sale watch (2 Nov): adidas India's own site shows an End of Season Sale. We found no official festive announcement from Nike India or Puma India yet. Coupon sites list codes and dates that disagree, so we don't repeat them. We post offers only from a brand's own page.
sources: https://www.adidas.co.in/eoss ; https://www.nike.in ; https://in.puma.com
