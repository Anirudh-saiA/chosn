# CHOSN landing page script: hero to waitlist

Scene-by-scene script for the home page. Lines in **bold** are the copy on the page today. Lines marked *(proposed)* are new suggestions, and nothing else is invented. Visuals and motion describe what the code does now.

---

## Scene 0: Hero (full-bleed looping video)

**Visual:** Full-screen background video. The CHOSN wordmark lands on top.
**Motion:** After the wordmark lands (~1.5s), the tagline slides up line by line out of a mask.

> **"You don't join CHOSN.**
> **You belong here."**

**Cue:** "Scroll down" at the bottom, which jumps to the next section.
*(proposed)* Optional one-line sub-head under the tagline: *Every pair, every store, one honest price.*

---

## Scene 1: 01 Compare.

**Visual:** Big "Compare." title on the warm off-white background. Below it, a worked example comparing the same shoe across stores.
**Labels in the example:** Retailers we compare, Delivery, How legit is the order.
**Callouts:** "6 days faster →" and "+27 trust points". The example is tagged "Illustrative figures".

*(proposed)* Voice-over / lead line:
> Same shoe, every store. See the price with shipping included, how fast it arrives, and how trustworthy the seller is, before you spend a rupee.

**Honesty note:** keep the "Illustrative figures" tag. Don't present the example numbers as live prices.

---

## Scene 2: 02 Discover.

**Visual:** Highlighted lead line and the brand logos across the top. A rotating wheel of upcoming shoes below.

> **Every _confirmed release_ on the calendar, with a _live countdown_ — so you know the minute it opens.**

**Motion:** The highlighted phrases fill in as the visitor scrolls (scroll-highlight).

---

## Scene 3: 03 Connect.

**Visual:** The community strip, with a community video panel.

> **Every drop deserves _a conversation_. Talk _style and sneakers_ with a community that shares your taste.**

Three feature cards:

| Title | Copy |
|---|---|
| **Cop or Drop.** | Put any pair to a vote and see where the community lands before you spend. |
| **Price checks & drop talk.** | Ask if a price is fair, or trade notes live in chat rooms that open with every drop. |
| **Legit checks.** | Post photos, follow the checklist, get a second pair of eyes — moderated and reputation-weighted. |

---

## Scene 4: Waitlist (video band)

**Visual:** Full-width background video (walking banner) with a dark wash so text stays readable.

> **join the waitlist.**
> **Early access to drop chat rooms, legit checks and Cop-or-Drop votes.**

**Form:** Email address, one button.
**States:**
- Success: **You're on the list — we'll email you.**
- Repeat signup: **You're already on the list.**
- Bad email: *That email looks invalid — double-check and try again.*
- Server error: *Something went wrong — try again in a moment.*

**After signup:** Mail 1 (welcome plus Instagram button) goes out right away. Mail 2 follows after 48 hours, personalised by shoe and interests. Every mail has an unsubscribe link.

---

## Footer

Site footer follows the waitlist band with no gap.

---

### Notes for the edit
- The page flow is Hero, 01 Compare, 02 Discover, 03 Connect, Waitlist, Footer, as in `apps/web/src/app/page.tsx`.
- Keep the hero as is. It was agreed earlier that the landing hero stays unchanged.
- Drops, News and Community pages are "Coming soon". Avoid wording that promises them as live.
- No reviews, ratings or testimonials appear anywhere, because none are sourced.
