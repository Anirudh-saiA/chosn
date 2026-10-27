# Proposal (not applied): Myntra budget-brand exclusion

Founder decision 2026-10-27 (sneakers only): leave out the cheap non-sneaker brands from Myntra. Proposed rule, for Main's REVIEW:

- Brand blocklist in the Myntra scraper (exact, case-insensitive): Roadster, Layasa, JQR, yoho.
- Prefer a category rule over brand guessing where Myntra gives one: keep only the "Sports Shoes" and "Casual Shoes" categories, drop "Flip Flops", "Sandals", "Floaters", "Slippers".
- Slide/sandal/flip-flop title words reuse NOT_SNEAKER from scripts/scrape_shopify_prices.py.
- Not applied: needs the Myntra scraper's brand/category fields checked against a real page, and a run, which only Nightly does.

Other open items: Converse 162053C retail price is 8,500 in our DB while Superkicks and Limited Edt charge 6,399; converse.in search shows the Chuck 70 High at 6,399 sale price with no MRP and a different product name, so it is not confirmed and left unchanged. Back end category field for sneakers: ask in office/tasks/backend.md.
