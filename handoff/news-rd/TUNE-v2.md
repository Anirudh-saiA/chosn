# Culture filter tune v2 (from Main's first-run report, 2026-10-21)

Patch: `culture-filter-tune-v2.patch`. It applies cleanly to Main's working tree as of today (`git apply --check` passed).
Touches three files: `apps/api/src/scripts/fetch-news-feeds.ts`, `apps/api/src/drops/news-logic.ts`, `apps/api/src/drops/news-logic.spec.ts`.

## What the first day showed (read from the 67 culture-lane stories stored in the database)

Good: Academy Museum Gala, Victoria's Secret Fashion Show, Met Opera gala, Lakmé Fashion Week, best-dressed lists, awards.
Noise (24 of 67):
- **Shopping and style listicles** from Who What Wear and Elle ("7 Elevated Fall Basics", "Satin Is Coming for Your Handbag Collection").
- **Gossip matched on the word "viral"**: "viral infection", "video goes viral" (Hindustan Times, Indian Express).
- **Words matched in the excerpt, not the headline**: "outfit", "runway" in unrelated stories.
- **"Jordan" matching a country**: "Princess Rajwa of Jordan" passed as if it were Air Jordan.
- Runway stories tagged **release** because the headline says "debut" (Kylie Jenner's runway debut).

## What changes

1. **Fashion-event words must be in the headline.** Footwear words still count in headline or excerpt. "viral" now counts only as "viral outfit/look/dress/gown/moment".
2. **Shopping filter**: headlines with shop / on-sale / under $N / "ways to style" / basics / must-haves are dropped.
3. **Added event names** so real events are not lost: Victoria's Secret, IIFA, Filmfare, Oscars, Grammys, Emmys, BAFTA, Cannes, Golden Globes, and season codes like SS27 or FW26.
4. **"Jordan" only as "Air Jordan" or "Jordan Brand"**, and brand words now use word boundaries.
5. **Categoriser**: a fashion event (gala, red carpet, runway, awards, fashion show, premiere) with no footwear word is `culture`, not `release`.
   Three new cases added to `news-logic.spec.ts`.
6. **Bug fix found on the way (already in the repo's HEAD):** the `STRICT` regex in `fetch-news-feeds.ts` contained four literal backspace
   characters where `\b` word boundaries belong, so parts of it (`kicks`, `trainers?`, `shoes?`) never matched. The patch restores `\b`. Effect: the
   "strict" feeds (Footwear News, Gear Patrol, Fashionista, Vogue, GQ, Esquire, Dazed and the Indian news feeds) may now pass a few more
   genuine footwear stories. Expect a small increase from them on the next run.

## Verified

- Replayed on the 67 stored stories: the new rule keeps 43 and drops 24, all 24 being shopping lists, gossip or non-events (list checked by hand).
- `news-logic.spec.ts`: 14 of 14 tests pass with the patch (11 existing, 3 new), run with the project's own vitest version.
- Patched `fetch-news-feeds.ts` passes strict TypeScript.
- Not run: the full fetcher against the live feeds and database.

## After applying

The 24 noisy stories already stored are harmless and expire after 45 days. Two optional tidy-ups for Main:
- To retag existing culture-lane stories with the new categoriser (so runway "debut" stories leave the release tab):

      UPDATE news_items SET tagged_at = NULL WHERE external AND source IN
        ('Page Six', 'Harper''s Bazaar', 'Elle', 'Who What Wear', 'WWD', 'Vanity Fair', 'Hypebeast Fashion', 'BellaNaija Style',
         'Pinkvilla', 'Bollywood Hungama', 'Hindustan Times Entertainment', 'Indian Express Entertainment', 'Luxebook India');

  then run `tag-news.js`. Review before running; I have not touched the database.
- Deleting the 24 noisy rows is optional and Main's call.

## Other observations from Main's report

- 16 duplicates hidden and 0 linked to a shoe or drop: normal, duplicate folding works. Shoe/drop links only appear when a story names a shoe on the calendar.
- Indian brand blogs gave only Campus (4). Expected.
- India lifestyle feeds (Vogue India, Rolling Stone India, HT Lifestyle, TOI Fashion, Indian Express Lifestyle, Inc42, YourStory, India Fashion Icon)
  produced nothing with the strict footwear rule. That is correct for a quiet week; the `STRICT` fix may bring a few.
- SEC: only Nike had a recent filing. Normal; these are infrequent.
- Not my area, noted for Main: the Puma India scrape failure belongs with the shoe-data session.
