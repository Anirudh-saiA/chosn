# Fact bank

One file per shoe. Everything in a file is either sourced (link on the line) or marked Opinion. The checked date is in each file. Re-check before posting if it is more than 30 days old, and check the style code of the pair you post about, because specs and factories change by colourway.

## File format (read by scripts/social_posts.py)
- `slug:` the file id. `db:` brand|MODEL pairs (comma separated, exact model names, case-insensitive) used to pull live rupee prices from our own database.
- `@post <id> | <Confirmed|Reported|Opinion>`, then `text:` (use `{min}`, `{med}`, `{max}` for live prices) and `sources:` (links separated by ` ; `).
- `@question <id>`, then `text:`.
- Confidence: **Confirmed** = the brand's own page says it. **Reported** = retailers, reviews or our scrape say it. **Opinion** = our take, marked "my take" in the text.
- Price numbers are listing prices in our scrape at Myntra, Ajio, Flipkart, Superkicks, Puma India and VegNonVeg. They are not MRPs and mix colourways. Resale stores are left out.
- Rule: never reuse the same post within 30 days (the script checks `office/social/posts/`).
