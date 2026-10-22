# Content calendar: Fri 23 to Thu 29 October 2026

Written 2026-10-22. The kind of post is set by weekday in `scripts/social_posts.py` (no repeat within 30 days). The script writes the draft each morning, so run it again that day and the prices are fresh. Morning is about 09:00 IST, evening about 19:00.

| Day | Morning (about 09:00) | Evening (about 19:00) |
|---|---|---|
| Fri 23 | **Sale:** the biggest listed discount in our data (store price against the MRP it shows) | **Reality:** adidas Superstar II, the brand page contradicts itself on leather |
| Sat 24 | **Reality:** Air Jordan 1 Low, two spec sheets under one name | **News:** the latest unexpected sneaker story, headline and credit, with a question |
| Sun 25 | **Random:** a culture or retail prompt | **Drops:** new releases of the week with retail price and how firm each date is |
| Mon 26 | **Reality:** New Balance 550, leather or synthetic by colourway | **Question** about the 550 |
| Tue 27 | **Drops:** new releases with prices | **Sale:** the day's biggest listed discount |
| Wed 28 | **Reality:** Dunk Low, the spec list against the price | **News:** an unexpected story |
| Thu 29 | **Collab:** the latest collab story with a question | **Random:** a culture or retail prompt |

Sale, news, collab and drops posts are built from the live data on the day, so only the kind is fixed here, not the shoe or story. A kind with nothing usable falls back to a reality post, a shoe question or a random prompt, and the draft says so. Reality posts rotate through the fact bank (10 shoes now); the founder can ask for a specific shoe to be reviewed next and I add it to the bank with sources.

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
