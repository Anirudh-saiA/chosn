# Fact bank

One file per shoe. Everything in a file is either sourced (link on the line) or marked Opinion. The checked date is in each file. Re-check before posting if it is more than 30 days old, and check the style code of the pair you post about, because specs and factories change by colourway.

## File format (read by scripts/social_posts.py)
- `slug:` the file id. `db:` brand|MODEL pairs (comma separated, exact model names, case-insensitive) used to pull live rupee prices from our own database.
- `@post <id> | <Confirmed|Reported|Opinion>`, then `text:` (use `{min}`, `{med}`, `{max}` for live prices) and `sources:` (links separated by ` ; `).
- `@question <id>`, then `text:`.
- Confidence: **Confirmed** = the brand's own page says it. **Reported** = retailers, reviews or our scrape say it. **Opinion** = our take, marked "my take" in the text.
- Price numbers are listing prices in our scrape at the active retail stores only (Myntra, Superkicks, Puma India, VegNonVeg), and only for pairs that actually have a live listing there. Rows whose listing_url contains FIXTURE are test data and are excluded; Ajio, Flipkart and END. Clothing are not live and are never named. They are not MRPs and mix colourways. Resale stores are left out. No shoe has more than a few real stores, so never write a store count without checking it.
- Rule: never reuse the same post within 30 days (the script checks `office/social/posts/`).
