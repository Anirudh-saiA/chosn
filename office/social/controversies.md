# Controversies bank

Used by `scripts/social_posts.py` for the "controversy" slot. Same rules as the fact bank: every claim has a source link on its `sources:` line; confidence is Confirmed (a primary document or the brand's own words), Reported (press or court reporting) or Opinion. We criticise products, prices, marketing and company decisions, never a private person. Nothing is called fake or a scam unless a court or the brand's own filing says so, and then we say who said it. Checked 2026-10-23 from search results; the pages were not opened in full, so the founder should skim a source before posting.

Format: `@item <id> | <confidence>`, then `text:` and `sources:` (links separated by ` ; `). A prompt is not reused within 30 days.

@item jordan1-banned | Reported
text: The "banned" Air Jordan 1 story is mostly marketing. Reports say the NBA's problem was the Nike Air Ship, and Nike's ad never named the shoe, so people filled in "Air Jordan 1". Sources disagree that the $5,000 fine was ever paid. My take: a great ad, a shaky claim.
sources: https://www.complex.com/sneakers/a/marvin-barias/the-true-story-behind-the-banned-air-jordan ; https://www.whatproswear.com/basketball/news/the-story-behind-michael-jordans-banned-nike-air-ship-sneakers/

@item nike-stockx | Reported
text: A US court found StockX liable for selling 37 pairs of counterfeit Nikes (March 2025). StockX said that was 0.0004% of 17.8 million Nike pairs it reviewed. The case settled in August 2025, terms confidential. My take: neither figure tells you what to check on your own pair.
sources: https://news.bloomberglaw.com/ip-law/nike-stockx-settle-nft-counterfeiting-lawsuit-ahead-of-trial ; https://decrypt.co/337472/nike-stockx-end-trademark-clash-nfts-fake-shoes

@item yeezy-inventory | Reported
text: After ending Yeezy, adidas said it held about €1bn of unsold stock and warned of a roughly €500m write-off if it never sold it. It sold in batches; one brought in about $437m. My take: hype and inventory are different things. Does that change what you'd pay?
sources: https://gulfnews.com/business/retail/adidas-plans-more-yeezy-stock-sales-in-august-1.97234259 ; https://www.rollingstone.com/music/music-news/adidas-leftover-yeezys-437-million-1234800279/ ; https://www.retailgazette.co.uk/?p=135569

@item seven-eleven-airmax95 | Reported
text: 7-Eleven sued Nike in July 2026, saying the Air Max 95 "7-Eleven" colours and release date could make buyers think the two had collaborated. It dropped the case with prejudice on 19 Oct; the court never ruled and no reason was given. My take: the question of who owns a colour scheme stays open.
sources: https://sneakerbardetroit.com/7-eleven-drops-nike-air-max-95-lawsuit/
