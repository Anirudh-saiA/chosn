# X (Twitter) posts

The voice is the critic: `voice.md`. Facts live in `facts/` (one file per shoe, with sources and the date checked). Every day `scripts/social_posts.py` writes `posts/<date>.md`: two posts whose kind rotates by weekday: a specific shoe (materials, construction, price in rupees from our scrape), a question, the biggest listed sale in our data, new releases with prices, collab news, unexpected news, a random culture prompt (`random.md`), a sourced controversy (`controversies.md`), an interesting fact (`trivia.md`), our own market numbers, or what stores stock most. A new shoe releasing today always leads the morning. Automating the posting itself: see `automation-proposal.md` (a proposal, not built). Each post lists its sources and a confidence line, and shows its length as X counts it (₹ counts as 2).

Nothing is posted automatically. The founder copies the text and attaches a picture. The 10-minute news cycle runs the script once after 07:00 and refreshes it once after 17:00.

- `calendar.md`: the next 7 days and the formats. `engage.md`: accounts to reply to and collab ideas (nobody is contacted). `weekly.md`: the Sunday review (the founder pastes impressions and replies).
- Pictures: drop them in `images/` (naming in `images/README.md`). `python scripts/social_images.py --date YYYY-MM-DD` (or `--all`) lists which post has a picture and which needs one.
- To add a shoe: copy a file in `facts/`, keep the format in `facts/README.md`, source every claim. A post is not reused within 30 days.
- Set `SOCIAL_SITE_URL` (for example `https://chosn.in`) once the domain exists and the drops note gets a link.
- Weekly pack for X's free Schedule box: `python scripts/social_week.py` writes `week-<start>.md` with the evergreen posts (facts, controversies, random, reality) for 7 days; the daily draft then says "already scheduled" for those slots and covers the live ones.
