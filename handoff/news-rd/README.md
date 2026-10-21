# News R&D handoff to MAIN

From: Head of R&D, News. To: MAIN. Date: 2026-10-21.
Status: **researched and tested, nothing applied to the app.** MAIN decides and applies.

## The one change

Add a **culture lane** to the existing `apps/api/src/scripts/fetch-news-feeds.ts`: 12 new feeds for celebrity, awards, fashion-week and
viral-outfit stories, plus one new filter mode, `'culture'`. Everything downstream (`tag-news.ts`, the `culture` category, the India flag,
dedup via `dup_of`, the 30/45-day windows) already handles these stories, so there is no schema change and no new script.

    cd C:\Users\aniru\OneDrive\Desktop\chosn
    git apply handoff\news-rd\fetch-news-feeds.culture-lane.patch      (path from the research worktree; copy the patch first)

Checked with `git apply --check` against MAIN's current file: applies cleanly. Not compiled or run against the database.

## What the patch does

- `Feed.filter` gains `'culture'`.
- New `CULTURE` regex: keep a story only if it is about footwear or a fashion moment (red carpet, gala, awards, fashion week, runway,
  best-dressed, street style, viral, outfit, ensemble, couture). Pure gossip is dropped.
- 12 feeds added. Each passed a robots.txt check for the CHOSN user agent and returned fresh items on 2026-10-21:

| Feed | Region | Kept by filter (live sample) |
|---|---|---|
| Page Six | global | 1 / 10 |
| Harper's Bazaar | global | 8 / 50 |
| Elle | global | 6 / 50 |
| Who What Wear | global | not sampled |
| WWD | global | 3 / 10 |
| Vanity Fair | global | not sampled |
| Hypebeast Fashion | global | not sampled |
| BellaNaija Style | global | not sampled |
| Pinkvilla | india | 1 / 50 |
| Bollywood Hungama | india | 1 / 50 |
| Hindustan Times Entertainment | india | 3 / 91 |
| Indian Express Entertainment | india | 4 / 200 |
| Luxebook India | india | not sampled |

Expect roughly a few dozen culture stories a day across all feeds, deliberately low volume. The filter tuning below is yours to adjust.

## Running it automatically

I found no scheduler wiring for `fetch-news-feeds` in the repo (searched `package.json`, `.github`, `docker-compose.yml`, `src/queue`).
MAIN should run these two commands, in order, from `apps/api` on whatever already schedules the other scripts (Railway cron or the BullMQ queue):

    node --env-file=.env dist/scripts/fetch-news-feeds.js
    node --env-file=.env dist/scripts/tag-news.js

Suggested cadence: every 30 minutes. About 40 feeds with a 1.5 s pause is roughly a minute per run. After pulling the patch, run `npm run build` in `apps/api` first.

## What I tested and rejected (do not revisit without a legal OK)

| Idea | Verdict |
|---|---|
| Google News RSS search (topic queries) | `news.google.com/robots.txt` disallows the search path, so your robots-checking fetcher would skip it. Links are also redirects, not publisher URLs. Rejected. |
| Bing News RSS | Returned 2017-2018 items for a recent query. Rejected. |
| Reddit RSS | `robots.txt` is `Disallow: /`. Rejected. |
| X / Instagram / TikTok | No permitted feed; the free relay (Nitter) is dead (410). Scraping breaks their terms. Rejected. |
| Sneaker News, Nice Kicks, Sole Collector, Slam Jam | Your own `data/releases/source_probe.json` shows robots.txt blocks us. Keep excluded. |
| Sole Retriever feed, VegNonVeg | Cloudflare 403 / robots block. Keep excluded. |
| Official brand newsrooms (Nike, adidas, Puma, New Balance, Converse, ASICS, Hoka, Salomon) | No working RSS; several block us. Their news reaches CHOSN through press coverage. A future option: the Nike and Puma newsroom HTML pages load (200), but parsing HTML pages needs a legal check first. |
| Paid news APIs (NewsData.io, GNews, NewsAPI) | Not sneaker-specific; free tiers have commercial-use limits. The RSS feeds above already cover the need. |
| KicksDB / Kicks.dev / StockX APIs | Could not confirm they exist as usable APIs. Not recommended. |

## Social media gap (honest limit)

CHOSN cannot read celebrity or brand posts directly. Coverage of a viral moment comes from publishers a few hours later. Instagram-only
drop announcements from Indian brands (Comet, Gully Labs, etc.) still need a human or Perplexity check, and per the research rules a date
seen only on Instagram is `reported` at most.

## Open items for MAIN

1. Apply the patch and wire the 30-minute schedule.
2. Review the first day of the culture lane in the news section and tell me if the filter is too tight or too loose; I will retune `CULTURE`.
3. Bollywood Hungama and Hindustan Times Entertainment returned items with no readable date in my quick probe. The existing parser
   handles `pubDate`, `dc:date`, `published` and `updated`, so they should be fine, but check the first run's report line for them.
4. Drops (release calendar) are a separate lane and unchanged: SoleDispatch and Sneaker Files calendars already feed `upcoming.json`.
   The Perplexity brief (`C:\Users\aniru\Downloads\research-brief.txt`) still has the six gaps I listed earlier; ask me for v2 when you want it.
