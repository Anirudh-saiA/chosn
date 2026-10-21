---
description: Turn pasted research (for example from Perplexity) into drops and news on the Releases page
argument-hint: <paste the research here, with its source links>
---

The user has pasted research about sneaker releases and/or sneaker news (usually from Perplexity). Add it to the site, carefully.

Research to add:

$ARGUMENTS

If the text above is empty, ask the user to paste it and stop.

## 1. Read it into entries

Split the text into **drops** (a release with a date) and **news** (a story with no single release date). One entry per release. Keep every source link next to the fact it supports. Ignore anything with no usable fact.

## 2. Check each drop before it goes in

- **Required:** brand, model, `releaseDate` (YYYY-MM-DD), `sourceName` and an https `sourceUrl`. A drop with no source link is NOT added: list it under "needs a source".
- **Confirmation level** (the site's honest-data rule; Perplexity alone is never enough for Confirmed):
  - `confirmed`: only when an official brand or retailer page states the date and you opened that link and saw it.
  - `reported`: two or more release trackers or outlets agree on the date (open the links).
  - `unconfirmed`: everything else, including a single source or a date you could not check.
- Open the source links (WebFetch or the browser) and check that the date, price and name appear there. If a link does not support the claim, downgrade it or skip it and say why.
- **Money in rupees:** India drops in `INR`. A US-only release keeps its dollar price with `"currency": "USD"` and `"regions": ["us"]` (the site converts and labels it). Never invent a price; leave `retailPrice` out when unknown.
- Time only if the source gives one (India time, `HH:MM`). Date-only otherwise.
- Set `regions` (india / us / global) and, when stated, put official buy links in `links` and raffle details in `raffle`.
- Indian homegrown brands (Comet, Gully Labs, Thaely, Neeman's, Bacca Bucci, Campus, CHNKS, Almost Gods, Red Tape) usually announce days ahead on their own site; a date from an Instagram post is `reported` at most unless their site says it.

## 3. Skip duplicates

Before adding, compare with `data/releases/upcoming.json` and the database (same brand, same date, same model words; the maintain script's `sameRelease` logic). Do not add a drop that already exists; if the new research has a better source or fixes a date, update the existing entry instead and say so.

## 4. Write the files

- Drops: append to `data/releases/upcoming.json` (format in `docs/releases-how-to-add-drops.md`).
- Videos: a YouTube link to an official sneaker video (brand or store channel, release trailer, collab film) goes in `data/releases/news.json` as a news story whose `sourceUrl` is the YouTube watch link (`https://www.youtube.com/watch?v=...`). The Watch page of The CHOSN Times plays it inside the magazine. Open the link and confirm it is the real channel and the right video first.
- News: append to `data/releases/news.json`. The `body` must be written in our own words (at least 40 characters), crediting `sourceName` and `sourceUrl`. Never copy an article or a Perplexity paragraph.

## 5. Import and tidy

From `apps/api`, run `npm run build` if the scripts are out of date, then:

    node --env-file=.env dist/scripts/import-drops.js
    node --env-file=.env dist/scripts/import-news.js
    node --env-file=.env dist/scripts/maintain-drops.js
    node --env-file=.env dist/scripts/tag-news.js

## 6. Report

Finish with a short table: what was **added** (name, date, confirmation level), what was **updated**, what was **skipped as a duplicate**, and what **needs a source** (and what to look for). Say plainly if a link could not be opened. Do not commit or push unless the user says "push".
