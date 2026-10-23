# Content calendar: Fri 23 to Thu 29 October 2026

Written 2026-10-22. The kind of post is set by weekday in `scripts/social_posts.py` (no repeat within 30 days). The script writes the draft each morning, so run it again that day and the prices are fresh. Morning is about 09:00 IST, evening about 19:00.

| Day | Morning (about 09:00) | Evening (about 19:00) |
|---|---|---|
| Mon | **Market:** our own numbers (same pair at two prices, markdowns by store, new listings) | **Interesting fact** (sourced history) |
| Tue | **New releases** with prices and how firm each date is | **Sale:** biggest listed discount |
| Wed | **Controversy** (sourced; criticises products and decisions, not people) | **Wearing:** what stores stock most, and a question to you |
| Thu | **Collab** story with a question | **Reality:** a specific shoe, materials, build, price |
| Fri | **Sale** | **Market** |
| Sat | **Unexpected news** | **Interesting fact** |
| Sun | **Controversy** | **Random:** culture and retail prompt |

Override: when a new shoe releases today (our drop calendar, confirmed or reported), the morning post is the new-release post, whatever the day.
Specific shoes are only one slot a week now; the rest is market, controversy, facts, news and community.

Only the kind is fixed. The shoe, story, sale or number is chosen from live data on the day, so run the script each morning. A kind with nothing usable falls back to another and the draft says so. The banks (`controversies.md`, `trivia.md`, `random.md`, `facts/`) are small, so tell me what to add: each item needs a source before it goes in.

The pictures are the founder's own. If a day has none, post the text alone rather than use an unlicensed image.

## Formats not scheduled yet (the fact bank cannot support them)
- **Retail versus resale:** needs paired retail and resale prices for one style code from our own data; the Data team's price history has to be checked first. Ask Main whether the resale prices (Culture Circle, Crepdog Crew) are comparable enough to post.
- **Real versus fake basics:** needs a sourced authentication guide per brand (tag, stitching, box label). Request for R&D. Until then no post makes an authenticity claim about any seller or product.
- **Collab spotlight:** needs the facts of one collab (what changed in the shoe, retail price, where it sells in India). Draft after the next confirmed collab on the drop calendar.

## Sunday 25: one more idea if the founder wants a thread
"Three Indian prices for one Samba": the same model at three stores in our scrape, with the style codes, and what differs. Source: our data and `facts/adidas-samba.md`. The founder decides whether to run it.

## Rules for the week
- Re-run `python scripts/social_posts.py` each morning for fresh prices; the 23 October draft already exists.
- Each draft lists sources and confidence; copy the sources as a reply if you want them visible.
- Paste engagement numbers into `office/social/weekly.md` on Sunday evening (impressions, replies) so the formats can be judged.
