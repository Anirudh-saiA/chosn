# Adding drops and news (Releases page)

Two files in `data/releases/`, two commands (run from `apps/api` after `npm run build`). Everything shows its source on the site.

## Drops: `data/releases/upcoming.json`

    node --env-file=.env dist/scripts/import-drops.js

One object per drop:

    {
      "styleCode": "IE3437",          // optional if brand + model are given; matches a shoe we track
      "brand": "Nike", "model": "Air Max 95", "colorway": "Greedy", "collab": "optional",
      "releaseDate": "2026-11-14",    // YYYY-MM-DD
      "releaseTime": "10:00",         // optional, India time. Leave out when only the date is known (no automatic "live now" post or push)
      "retailPrice": 11999, "currency": "INR",   // optional; INR for India, USD for US tracker dates
      "regions": ["india"],           // india | us | global
      "status": "upcoming",           // or "released" for a past release (shown as Released)
      "confirmation": "confirmed",    // confirmed (an official brand or retailer page states it) | reported (trackers agree) | unconfirmed (one source, or sources disagree)
      "sourceName": "adidas India", "sourceUrl": "https://...",   // required
      "links": [{ "label": "adidas.co.in", "url": "https://..." }],  // optional official places to try to buy
      "raffle": { "opensAt": "2026-11-10T10:00:00+05:30", "url": "https://...", "note": "Raffle" }  // optional
    }

A shoe that is not in our stores yet is added as a bare entry (no prices, so it never appears in Compare). Re-running updates the same drop
(same shoe and date). Invalid entries are listed and skipped.

## News: `data/releases/news.json`

    node --env-file=.env dist/scripts/import-news.js

    { "title": "...", "body": "Written in our own words (40+ characters).", "publishedAt": "2026-10-20", "sourceName": "Esquire India", "sourceUrl": "https://...", "breaking": false }

Always credit and link the source; never copy an article.

## Where dates come from

Brand and retailer pages and apps (confirmed), release trackers such as Sneaker Files and SoleDispatch (reported), single-source leads (unconfirmed).
Indian homegrown brands usually announce on their own site and Instagram a few days before a drop; keep their cards in
`apps/web/src/components/releases/IndiaWatch.tsx` up to date (it shows a "last checked" date).

Public vs local: demo rows are hidden unless `SHOW_DEMO_RELEASES=1` (set in your local `apps/api/.env`; do not set it in production).
The whole calendar is also available as `GET /drops/calendar.ics`.

## What runs by itself every night (daily_update.py)

| Step | Does |
|---|---|
| Exchange rates (`update-fx.js`) | USD and GBP to rupees (ECB reference rate via Frankfurter), so every price shows in rupees |
| News feeds (`fetch-news-feeds.js`) | Headlines and links from 8 public sneaker / fashion feeds, each checked against robots.txt first |
| Release dates (`scrape_release_dates.py` then `import-drops.js`) | Upcoming dates, prices and style codes from SoleDispatch; new ones are "Unconfirmed", a moved date is updated and flagged |
| New arrivals, outlook log, wishlist alerts | as before |

Pictures: a drop shows its picture automatically as soon as any store we read lists that shoe (matched by style code). For shoes no store
has yet, add `"imageUrl": "https://..."` (a picture you have the right to use, for example from a brand press kit) to the drop in
`upcoming.json`; otherwise a placeholder is shown.
