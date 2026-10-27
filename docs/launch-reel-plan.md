# CHOSN launch reel: plan, script, subtitles, graphics

Format: vertical 9:16, 1080 x 1920, 30 fps, about 34 seconds. First cut is silent (no audio). You generate the voice in ElevenLabs from the script below and I fit the cuts to it.
Rule: show the phone, not the desktop site. Everything on screen is the real site in a phone, with real prices read from our database on the day we record. No community, no features we do not have.

## Voice-over script (paste into ElevenLabs)

Write "Chosen" for the voice (that is how it is said). Subtitles and graphics use CHOSN.

```
Same sneaker. Three stores. Thousands of rupees apart.

This is Chosen. Every store. One honest price.

See every store side by side. Shipping, delivery time, and the cheapest one highlighted.

Know when to buy. Chosen reads the price history, and tells you: buy now, or wait.

Never miss a drop. The release calendar, the sneaker news, and our own magazine, the Chosen Times.

That's just the start. More is coming. Stay tuned.
```

About 70 words. Voice direction: confident, quick, a little dry; calm, not shouting. A young, clear Indian-English or neutral voice. Pace about 2.3 words a second, short pauses between the six blocks. Generate each block as its own take if you can (easier to cut to). Send me the MP3(s) and I fit the visuals to the real timings.

## Timeline

| Time | Scene | Voice | On screen |
|---|---|---|---|
| 0.0 to 3.8 | 1. Hook | "Same sneaker. Three stores. Thousands of rupees apart." | One shoe, three price tags land one by one (real prices from three stores), the gap highlighted in yellow. |
| 3.8 to 7.8 | 2. Logo | "This is CHOSN. Every store. One honest price." | The new globe logo draws itself in line by line, then "CHOSN" snaps in; the line "Every store. One honest price." |
| 7.8 to 15.0 | 3. Feature one: Compare | "See every store side by side..." | Phone: the compare page. Store rows slide in, shipping and delivery time tags, the cheapest row lights up yellow. |
| 15.0 to 22.0 | 4. Feature two: Buy now or wait | "Know when to buy..." | Phone: the price outlook card on a shoe. A price line draws, then the verdict pill flips to "Buy now" or "Wait". |
| 22.0 to 29.0 | 5. Feature three: Releases | "Never miss a drop..." | Phone: the drop calendar (yellow day highlight), then news front page, then the CHOSN Times magazine cover with page turn. |
| 29.0 to 34.0 | 6. Close | "That's just the start. More is coming. Stay tuned." | Logo returns, "More coming. Stay tuned." and "Join the waitlist" with the site name (domain to be added). |

## Subtitles (burned in, word by word, large, lower third)

1. Same sneaker. Three stores. Thousands of rupees apart.
2. This is CHOSN. Every store. One honest price.
3. See every store side by side. Shipping, delivery time, the cheapest one highlighted.
4. Know when to buy. CHOSN reads the price history, and tells you: buy now, or wait.
5. Never miss a drop. The release calendar, the sneaker news, and our own magazine, the CHOSN Times.
6. That's just the start. More is coming. Stay tuned.

(An SRT with real timings is made once the voice is in.)

## Graphics: what the reel needs

Look: cream background (#EEE4D0), ink black, navy (#14213D), yellow highlight (#FFD54A), one orange accent. Type: Anton for headlines, JetBrains Mono for tags, Manrope for subtitles. Same system as the earlier product reels, with the new logo.

Needed (I produce all of it; items marked YOU are yours):
1. **The new logo**: done, in the site (`apps/web/public/images/logo-full.png`, `logo-word.png`). For the reveal I animate the globe lines drawing in, then the wordmark.
2. **Phone mock-up**: a clean modern phone frame, drawn in CSS, with a soft shadow, slight tilt and slow float. The screen shows real screen recordings.
3. **Screen recordings of the real site at phone size** (390 x 844, 2.5x): compare page, price outlook card, drops calendar, news front page, magazine cover and a page turn. Recorded from the live local site against today's data.
4. **Product pictures**: three store listings of one shoe with cut-out pictures (from our own catalogue images).
5. **Motion**: text masks sliding up, price chips popping in, a yellow highlight sweeping behind key words, a line chart drawing, a verdict pill flipping, calendar day highlight, page-turn on the magazine, wipe transitions between scenes (navy wipe with a yellow edge), subtle grain and floating dust.
6. **Captions**: word-by-word highlight in a dark rounded lower-third.
7. **End card**: logo, "Stay tuned", waitlist line. YOU: tell me the site name or handle to show (the domain is not bought yet; until then it says "Join the waitlist").
8. YOU, optional: a short clip of your own sneakers or a hand scrolling the phone for the hook. If you do not, the hook uses our own product cut-outs.

Do not use: other brands' logos on the screen beyond what the site already shows, ads, a community scene, unconfirmed claims ("saves you X rupees" without the real numbers on screen).

## Open Montage (if you want to edit it yourself)

Once the first cut is rendered you can import the MP4 and the SRT. If you would rather build it in Open Montage, I will write one prompt per scene from the table above.


---
# Version 2 (premium cut): script for ElevenLabs

Write "Chosen" for the voice. Calm, confident, unhurried, like a premium product launch. One take per block if you can.

```
The same sneaker. Seven stores. Prices all over the place.

This is Chosen. Every store you shop, in one place.

Compare every store side by side. Shipping, delivery time, and the cheapest one, highlighted.

Track the price over time. Chosen reads the history, and tells you: buy now, or wait.

Pay the way you like. See which stores take UPI, cards, EMI, or cash on delivery.

Never miss a drop. The release calendar. The sneaker news. And our own magazine, the Chosen Times.

Chosen. Coming soon.
```

Look: pure black and white, no gradients, a real iPhone frame, one shoe (adidas Samba OG, Cloud White / Core Black, UK 8) with real prices from seven stores, price tracking, payment options, Releases, news and the magazine. Music only at the end.
