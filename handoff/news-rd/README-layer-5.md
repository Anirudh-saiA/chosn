# News R&D handoff 3: layer 5, newsletters and email alerts

From: Head of R&D, News. To: MAIN. Date: 2026-10-21. Nothing applied to the app, nothing subscribed, no account created.

## What it is

`fetch-email-news.ts` reads **one dedicated CHOSN mailbox** over IMAP and turns two kinds of mail into news items:

1. **Google Alerts**: one item per result, linking straight to the publisher's article (Google's redirect link is unwrapped).
2. **Brand and store newsletters**: one item per email that announces something (drop, launch, collab, restock). Sale and discount mail is skipped.

This is the legitimate route to announcements that only exist as email or as a Google-indexed article, with no feed and no robots.txt issue,
because CHOSN is the subscriber and the mailbox is its own.

## Files

| File | Purpose |
|---|---|
| `fetch-email-news.ts` | The script, to go in `apps/api/src/scripts/` |
| `fetch-email-news.check.mts` | The 19 checks I ran (see below); optional to keep |
| `README-layer-5.md` | This file |

## Verified

- Strict TypeScript check passes (in a scratch folder with `imapflow` 2.5.9, `mailparser` 3.10.0, `pg` and their types installed).
- **19 of 19 checks pass**, using real MIME messages parsed by `mailparser`:
  Google Alert unwrapping (duplicates, non-result links, `http://` links and too-short titles are dropped); newsletter sender matching through
  subdomains and rejection of look-alike domains (`notsuperkicks.in`); promo-only subjects skipped while "sale ends, new drop inside" is kept;
  a tracking token in a web-version link never reaching the stored row; the 180 character excerpt; and the SPF/DKIM pass check.
- With no credentials set, the script prints a one-line skip message and exits cleanly.

## Not verified (needs a real mailbox)

- The live IMAP connection (`imapflow` login, search, fetch) has **not** been run. It needs a real mailbox and app password.
- The sender domains in `SENDERS` are my best guesses, not read from real emails. Run `--discover` after the first newsletters arrive and fix them.
- The insert into `news_items` is copied from the other fetchers and has not been run against the database.

## Safety design (why this is safe to publish from)

- **Allow-list only.** Mail from any sender not in `SENDERS` (or Google Alerts) is ignored, so strangers cannot put text on the site.
- **Verified senders only.** A message is used only if the receiving server recorded an SPF or DKIM pass; a forged "From" is ignored.
- **No subscriber-identifying links.** A newsletter's own "view in browser" link usually carries a token tied to the mailbox. It is never
  stored. The "Read at" link goes to the brand's public site with a harmless `#mail-<hash>` fragment so each email stays unique.
- **Plain text, short.** Only the subject (headline) and a 180 character plain-text excerpt are kept. No HTML, images or full body.
- **Read-only.** The mailbox is opened read-only; nothing is deleted or flagged.
- Newsletters are the brands' own marketing, sent to a subscriber. A headline plus a short excerpt and a link to the brand's page matches what
  the feed fetchers already do. If a brand objects, remove it from `SENDERS`.

## Setup steps (for you, not me: these are account and subscription actions)

1. **Make a dedicated mailbox**, for example a new Gmail account used only for this. Do not use a personal inbox.
2. Turn on 2-step verification, then create an **app password** (Google Account, Security, App passwords). Enable IMAP in Gmail settings.
3. In `apps/api/.env` and on the host, set:

       NEWS_IMAP_USER=<mailbox address>
       NEWS_IMAP_PASSWORD=<the app password>
       # optional: NEWS_IMAP_HOST (default imap.gmail.com), NEWS_IMAP_FOLDER (default INBOX)

4. In `apps/api`, add the two packages:

       npm install imapflow mailparser
       npm install -D @types/mailparser

5. **Subscribe that mailbox** to the newsletters below, using each brand's own sign-up form (you do the sign-ups; I did not subscribe anything).
6. **Create Google Alerts** (alerts.google.com, signed in as that mailbox) with these settings: "As-it-happens", sources "Automatic",
   language English, region India or Any, "All results". Suggested queries:

       sneaker release India
       "Superkicks" OR "Crepdog Crew" OR "VegNonVeg" OR "Culture Circle" OR "Limited Edt"
       Comet sneakers OR "Gully Labs" OR Thaely OR "Neeman's" OR "Bacca Bucci"
       Nike India OR "adidas India" OR "PUMA India" OR "New Balance India" OR "ASICS India"
       celebrity sneakers OR "street style" sneakers
       "Lakmé Fashion Week" OR "Paris Fashion Week" OR "Met Gala" outfit
       "red carpet" viral outfit OR "best dressed"
       Jordan OR Dunk OR "Air Max" release date

7. Wait a day or two for mail to arrive, then run `node --env-file=.env dist/scripts/fetch-email-news.js --discover`. It lists every sender
   not yet on the allow-list. Add real mail domains to `SENDERS`, then rebuild.

### Newsletters to subscribe the mailbox to

Nike (SNKRS and nike.com/in), adidas India, PUMA India, New Balance India, ASICS India, Superkicks, Crepdog Crew, Limited Edt, Culture Circle,
Mainstreet Marketplace, Comet, Gully Labs, Thaely, Neeman's, Campus, Bacca Bucci, CHNKS, Almost Gods, Red Tape.

## Running it

After the other news scripts, before the tagger:

    node --env-file=.env dist/scripts/fetch-news-feeds.js
    node --env-file=.env dist/scripts/fetch-official-news.js
    node --env-file=.env dist/scripts/fetch-email-news.js
    node --env-file=.env dist/scripts/tag-news.js

Every 30 minutes is fine. It reads at most the last 14 days and 300 messages per run, and duplicates are ignored by the unique source link.

## Limits to expect

- Google Alerts results are headlines from other publishers; they link to the original, and `tag-news` removes near-duplicates of stories your
  feeds already picked up.
- Newsletters are mostly promotional; the subject filter keeps only announcement-style mail, so volume will be low.
- A brand that sends from a domain not in `SENDERS` is silently ignored until you add it. That is what `--discover` is for.
- Gmail may require an app password to be re-created if Google security settings change; a failed login shows in the script's error output.
