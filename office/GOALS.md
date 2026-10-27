# CHOSN goals

Written 2026-10-23. Every team reads this with `ORG.md`. When a goal here conflicts with a team's own brief, this file wins; tell Main.

## The company goal
CHOSN is India's honest place to compare sneaker prices and follow drops and news. The goal is to be **launch-ready and trustworthy**: every price, date and claim is true and traceable to its source, the site works well on a phone, user data is handled safely, and a small daily rhythm (data, news, magazine, posts) runs without the founder watching it.

No public launch date is set. The launch plan, in order: finish the features, deploy and observe, buy the domain, go public. Until the founder says otherwise, nothing goes public and nobody is contacted on his behalf.

The one rule above all: **never show a number or claim we cannot trace.** (On 2026-10-23 test rows were found mixed into live prices; that must never happen again.)

## What each team is for, and what "done" looks like for launch

| Team | Goal | Done when |
|---|---|---|
| **Main (Founder/CEO session)** | Keep one true picture of the company: review, integrate, record, flag risk. | Every team's work is reviewed; the founder's changes are logged and passed on; nothing merged without "approve", nothing pushed without "push". |
| **Front end** | A fast, clear, mobile-first website. | No known layout bug at 375 to 390 px; accessibility checked; patched Next.js; legal copy correct (the privacy page's age is fixed). |
| **Back end** | A safe, correct API and database. | All critical and high dependency fixes landed; privacy routes work (delete account removes alert e-mails, waitlist deletion exists); locks so more than one API instance is safe; tests green; test rows never served. |
| **Data** | Reliable, clean prices from every active store, and datasets ready for ML. | A complete daily run with no silent gaps; no test rows or stale values; 60 to 90 days of history by mid-December; every dataset documented. |
| **Drops and News** | A true release calendar, on-topic news and a daily magazine. | Every drop date shows its source and firmness; no off-topic story; today's CHOSN Times prints with a cover and a drops page; feeds that fail are known. |
| **Nightly** | The scheduled jobs run on time and tell the truth. | The 02:00 job, the weekly job and the 10-minute cycle run every day; a morning health report by 08:00; the database backup is restorable. |
| **Security** | No exploitable weakness at launch. | No critical or high finding open; the exposed secrets rotated (founder); re-audit after each fix lands. |
| **R&D** | Sourced answers, fast. | Each question answered in a file with sources and a Confirmed / Reported / Unconfirmed mark; no product code. |
| **Social** | A steady, honest X presence in the critic voice. | Two draft posts per day ready to copy, a 7-day calendar, a fact bank at the right confidence; nothing posted without the founder. |
| **Outreach** | The right people hear about CHOSN, through the founder. | A verified lead list (consumer, e-commerce, sneaker-culture; not deep-tech funds), deadlines tracked, drafts ready; nothing sent by us. |
| **AI/ML (starts about mid-December)** | Models that use real data. | Starts when Data has 60 to 90 days of history and licensed photos. |

## Rules that never change
- Every number and claim traces to a source, marked Confirmed, Reported or Unconfirmed. If a claim cannot be traced, cut it.
- Honest status: CHOSN is pre-launch; the AI legit check is planned, not built; never "first in India"; never state a count (stores, users, partners) we have not verified.
- Prices in rupees. No test (fixture) rows, no pending-integration store shown as live.
- Teams push only their own branch, never develop or main. Main merges on "approve" and pushes on "push".
- No outward action (e-mail, DM, post, sign-up, purchase, publishing) without the founder's explicit word to that team or to Main.
- Never print or commit secrets.
