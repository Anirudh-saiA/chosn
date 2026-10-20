# Upcoming drops (Releases page)

CHOSN lists **confirmed** drops only, each with the source that confirmed it. No rumours, no "leaked" dates.

Add a drop to `data/releases/upcoming.json`, then run (from `apps/api`):

    node --env-file=.env dist/scripts/import-drops.js

Format (an array; one object per drop):

    {
      "styleCode": "IE3437",                 // a shoe we already track (its style code)
      "releaseDate": "2026-11-14",           // YYYY-MM-DD
      "releaseTime": "10:00",                // optional, India time (HH:MM); leave out if only the date is confirmed
      "retailPrice": 11999,                  // optional, INR
      "regions": ["india"],                  // india | us | global
      "sourceName": "adidas India",          // required: who confirmed it
      "sourceUrl": "https://www.adidas.co.in/...", // required: https link to read it
      "links": [{ "label": "adidas.co.in", "url": "https://www.adidas.co.in/..." }],   // optional: official places to try to buy
      "raffle": { "opensAt": "2026-11-10T10:00:00+05:30", "url": "https://...", "note": "Raffle" }   // optional
    }

Running it again updates the same drop (same shoe and date) instead of adding a copy. Entries that are not valid or for a shoe we do not
track are listed and skipped.

Where to find confirmed dates: the brand's own launch page or app, the retailer's own announcement, or a named publication. Keep the link.
