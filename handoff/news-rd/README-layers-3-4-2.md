# News R&D handoff 2: layers 3, 4 and 2

From: Head of R&D, News. To: MAIN. Date: 2026-10-21. Follows `README.md` (culture lane). Nothing applied to the app.

## What is in this package

| File | What it is | Verified |
|---|---|---|
| `fetch-official-news.ts` | New script for `apps/api/src/scripts/`. Layer 3 (official company news via SEC EDGAR) and layer 4 (YouTube Data API) | Passes the project's strict `tsc` check. SEC half run live today; YouTube half tested only on the filter, because it needs a key |
| `fetch-news-feeds.indian-blogs.patch` | Layer 2: 6 Indian brand/store blog feeds added to `FEEDS` | Applies cleanly after the culture-lane patch (both applied in order to a copy of MAIN's file) |
| `permission-emails.md` | Draft emails to the blocked sneaker sites. Drafts only, nothing sent | n/a |

Apply order in MAIN: `fetch-news-feeds.culture-lane.patch`, then `fetch-news-feeds.indian-blogs.patch`, then copy `fetch-official-news.ts` into
`apps/api/src/scripts/`, then `npm run build` in `apps/api`.

## Layer 3 changed from my plan: press wires failed, SEC filings replace them

| Tried | Result |
|---|---|
| Business Wire RSS | robots.txt disallows us |
| PR Newswire, GlobeNewswire, PIB India | Errors or unreadable robots.txt |
| Nike, adidas and Puma investor-relations RSS | Errors or unreadable |
| SEC EDGAR `data.sec.gov` JSON API | Works, no key, official, designed for programs |

So layer 3 is now SEC Form 8-K filings for **Nike, Crocs, Deckers (HOKA, UGG) and Under Armour**, all with current filings (live check today).
Skechers and Foot Locker are excluded: they went private and their last filing is from 2025. Non-US brands (adidas, PUMA, ASICS, New Balance,
Reebok) file nothing with the SEC, so they get no coverage here; New Balance is private.

How it stays safe: each filing becomes a headline **we write ourselves** from the filing's item codes (for example "Nike reports a change in
leadership and a company announcement in an official SEC filing"), with a link to the filing. Filings that only carry a shareholder-vote result
(item 5.07) are skipped. Honest limit: the headline says what kind of news it is, not the details. Readers click through for those.

## Layer 4: YouTube, official API only

- YouTube's own RSS path is **disallowed by its robots.txt**, so the only permitted route is the YouTube Data API v3.
- **MAIN must create a free API key** (Google Cloud console, YouTube Data API v3) and set `YOUTUBE_API_KEY` in `apps/api/.env` and on the host.
  Without it the script skips YouTube and says so in its report line.
- Cost: one quota unit per channel per run. 8 channels every 30 minutes is about 400 units a day against the 10,000 free daily quota.
- Channels included (ids read from their public pages today): Nike, adidas, New Balance, Reebok, Converse, Vans, Crepdog Crew, Superkicks.
  **Still to find:** PUMA India, ASICS, Comet, Gully Labs, Thaely (their handles did not resolve). Add them to `CHANNELS`.
- A footwear/launch keyword filter drops sport, corporate and ad videos. Expect low volume.
- Stored per video: title, date, link, 180 character description excerpt. Same as a news feed.

## Layer 2: Indian brand blogs, and why it is small

Tested the Shopify blog feed for all 12 Indian brands and stores. Six are included. Most are quiet:

| Brand | Latest post in feed |
|---|---|
| Campus | 2026-10-14 (active) |
| Gully Labs | 2026-07-30 |
| Superkicks | 2025-04-14 |
| Limited Edt | 2025-02-21 |
| Thaely | 2024-06-20 |
| Crepdog Crew | 2024-03-07 |

Not included: Comet, Neeman's and CHNKS (no blog feed), Almost Gods and Red Tape (feed exists but is empty), Bacca Bucci (last post 2022),
VegNonVeg (blocks us). The fetcher's 30-day window means quiet blogs add nothing until they post, which is harmless.

**The real India signal already exists:** `track-new-arrivals.ts` records the first day each store lists a shoe from their product feeds, and the
Releases page already shows those as "just landed". Do not duplicate it. Layer 2 only adds the brands' written announcements.

## Running it

Add one line to whatever schedules the news scripts, before `tag-news`:

    node --env-file=.env dist/scripts/fetch-news-feeds.js
    node --env-file=.env dist/scripts/fetch-official-news.js
    node --env-file=.env dist/scripts/tag-news.js

SEC allows under 10 requests a second and wants a contact in the User-Agent. The script makes 4 requests with a 0.4 s pause and uses the
same identifying User-Agent as `fetch-news-feeds.ts`.

## Not verified

- The YouTube API call has not been run (no key). The request URL and response shape follow Google's documented `playlistItems.list`; the first
  run's report line will show an HTTP status if anything is wrong.
- The insert into `news_items` is copied from `fetch-news-feeds.ts` and has not been run against the database.
- Source label for SEC items is "<Company> (SEC filing)"; `tag-news` brand detection runs on the headline, so those should tag to the brand.
