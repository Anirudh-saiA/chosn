# What does India's DPDP Act require for CHOSN's waitlist, drip e-mails and watch ids, and what must we build?
**This is research, not legal advice. A real lawyer must review before public launch** (the repo's own `docs/legal/README.md` already says the same about the draft privacy policy).

**Answer / recommendation:** The Act and its Rules apply to CHOSN as a "Data Fiduciary" (it decides why and how personal data is used). The Rules were notified in November 2025 with an **18-month phase-in, so the main duties start around May 2027** (my calculation from the notification date, Reported). Build for them now, because the data collected from today is covered. What the code already does well: consent-gated analytics, unsubscribe tokens, and a self-serve account delete that really erases. **The five gaps that matter, in order:** (1) the privacy page says 13+ but the Act's child threshold is **18**; (2) the `watches` table (price-alert e-mails) is **not erased by account deletion and not listed in the privacy table**; (3) no way for a waitlist-only person to ask for deletion except e-mail, and the `privacy@chosn.app` mailbox does not exist yet; (4) no written breach runbook (Board within 72 hours); (5) notice and consent wording not yet checked against the "standalone notice" rule, and English only.
**Confidence:** medium. **Why:** the notification, 18-month timeline, 90-day response and breach duties are confirmed by the government press release or reported consistently; section-level text and some Rule details (log retention, languages, startup exemption) could not be read from official text and are marked Unconfirmed.

**Labels:** Confirmed = government page or our own code; Reported = law-firm, consultancy or commentary page; Unconfirmed = could not verify.

## What the law says (sources)
| Point | What it says | Status | Source |
|---|---|---|---|
| Act enacted, Rules notified | Act enacted 11 Aug 2023; Rules notified; PIB release dated 14 Nov 2025 | Confirmed | [PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014&reg=3&lang=2) |
| Timeline | "18-month phased compliance timeline". Reported split: Board provisions at once, consent managers at 12 months, fiduciary duties at 18 months, so about mid-May 2027 | 18 months Confirmed; split Reported | [PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014&reg=3&lang=2), [EY India, 15 Dec 2025](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025) |
| Notice | A "standalone", clear, simple consent notice explaining the specific purpose. Reported contents: what data, why, how to exercise rights and complain, a contact link | Confirmed (standalone, purpose); Reported (contents) | PIB; EY |
| Consent | "free, specific, informed, unconditional and based on clear affirmative action" | Reported | EY |
| Contact | Display clear contact information (a designated officer or DPO) | Confirmed | PIB |
| Rights | Access, correct, update, erase, nominate someone; respond within **90 days** at most | Confirmed | PIB |
| Breach | Tell affected people promptly, in plain language: what happened, likely consequences, steps taken, contact. Reported: tell the Board without delay and send a detailed report within **72 hours** | People Confirmed; 72 hours Reported (one consultancy page, flagged by the search as not verified against the Rules text) | PIB; EY |
| Security | Reported: baseline safeguards (encryption, access control, log retention). The "one year of logs" figure is Unconfirmed | Reported / Unconfirmed | EY |
| Retention and erasure | Define purpose-specific retention. Reported: 48-hour warning before erasure; three-year-after-last-use deletion applies only to very large e-commerce, gaming and social platforms (for example 2 crore users), which CHOSN is not | Reported | EY |
| Children | Verifiable consent from a parent before processing a child's data (child = under 18); no behavioural monitoring or targeted advertising aimed at children | Consent Confirmed; age 18 and the ban Reported | PIB; EY; [Act schedule commentary](https://www.dpdpa.com/theschedule.html) |
| Significant Data Fiduciary | Extra duties (audits, impact assessment, officer) only if the Government designates a company; CHOSN is not near that | Confirmed (exists); threshold Unconfirmed | PIB |
| Penalties (Act Schedule) | Up to **₹250 crore** for failing reasonable security safeguards (s.8(5)); up to **₹200 crore** for failing to notify a breach (s.8(6)) or for breaching the children's duties (s.9); up to ₹50 crore for anything else | Reported | [Act schedule text](https://www.dpdpa.com/theschedule.html), [KS&K](https://ksandk.com/data-protection-and-data-privacy/penalties-adjudication-under-indias-dpdp-act-2023/) |
| Startups | PIB says a "facilitative compliance regime" for startups and smaller enterprises; the Act (s.17(3)) lets the Government exempt some. What exemption, if any, applies to CHOSN is not established | Unconfirmed | PIB |

I could not read the Act or Rules text itself (the Ministry and PIB document files refused my tools or were not machine-readable). Section numbers other than s.8(5), s.8(6) and s.9 are not cited because I did not verify them.

## What CHOSN collects (read from the code) and what each needs
| Data | Where | What the law needs | State today | Build |
|---|---|---|---|---|
| **Waitlist**: e-mail, name, interests, tracked shoes, join time, source | `waitlist_entries` | Standalone notice at sign-up saying what, why, how long; clear opt-in; withdrawal as easy as giving it | Unsubscribe token and `unsubscribed_at` exist (Confirmed). Privacy page: kept "until you ask… or 24 months after launch" (a number chosen in-house, not from law) | Check the sign-up notice wording against the standalone rule; give waitlist-only people a deletion route (a form or the e-mail below) |
| **Drip e-mails** (welcome, follow-up) | `waitlist-drip.service.ts`: one welcome, one follow-up after 48 hours | Use only for the purpose consented to (waitlist news). Further marketing needs fresh consent. Honour unsubscribe at once | Two mails then stops (Confirmed). The send query skips rows with `unsubscribed_at` set (Confirmed, `waitlist-drip.service.ts` line 87) | Keep a minimal suppression record so an unsubscribed person is not mailed again (lawyer to confirm what may be kept) |
| **Watch ids and alerts**: anonymous watch id; optional e-mail (confirmed by token), watched shoes, target price, alerts | `watches`, `watch_items`, `watch_alerts` | E-mail is personal data; an id that can be linked to a person is too. Needs notice, consent, erasure | Confirmed e-mail opt-in (`email_confirmed`, token). **Not in the privacy-page table. The delete-account route deletes `users`, `subscribers` and `waitlist_entries` by e-mail, but not `watches`.** | Add `watches` (by e-mail) to account deletion and to the privacy table; a delete link in every alert e-mail |
| **Accounts**: e-mail, password hash, display name, optional 2FA secret, Google ids | `users`, `accounts` | Safeguards; erasure | Self-serve erasure built and tested (Confirmed, `docs/legal/README.md` and the route) | Keep; add the 90-day response promise for requests not covered by self-serve |
| **Community**: posts, images, comments, chat, votes, reports | community tables | Notice; erasure vs. moderation records; children | Reports kept as a moderation record (documented). I did not verify that posts and comments are removed on account deletion | Back end to confirm cascade; document what is kept and why |
| **Analytics** (PostHog; `offer_events` with a visitor id) | consent banner, `track.ts` | Consent first; no tracking of children | PostHog loads only after consent (documented Day 19). The first-party `offer_events` visitor id is described as recorded "where a visitor agreed to analytics" | Re-check on release; document both in the privacy page |
| **Web push** subscriptions | `web_push_subscriptions` | Notice; withdrawal | Removed on turning push off or deleting the account (documented) | Keep |

## Gaps in order of risk
1. **Children (highest).** The privacy page says 13+ and no under-13 accounts. The Act's child threshold is 18 (Reported), with parent consent and no tracking or targeted ads for under-18s. Sneaker readers skew young. Options: (a) **18+ only** in the Terms with an age question at sign-up, simplest and cheapest, but an unverified age box may not satisfy a regulator (Unconfirmed); (b) accept under-18s only with verifiable parental consent, which needs a flow and a verification method we do not have; (c) allow under-18s to browse with no accounts, no e-mail, no analytics. **Recommendation: (a) plus (c) for launch, and ask the lawyer.**
2. **Erasure gaps:** `watches` rows keep an e-mail after account deletion (Confirmed from the route). Fix before launch.
3. **Contact:** `privacy@chosn.app` is named but "does not exist yet" (repo docs). A person must monitor it, and a 90-day maximum response should be inside the process (the privacy page promises 30 days, which is stricter and fine).
4. **Breach runbook:** a one-page plan: who decides, tell the Board without delay, a detailed report within 72 hours (Reported), tell affected people in plain language. Needs logs and contact lists to exist before an incident.
5. **Notice and consent wording:** standalone, plain language, purpose-specific. The docs say English only; whether the Rules require other Indian languages is Unconfirmed.
6. **Processors and transfers:** Resend, PostHog, Sentry, Railway, Cloudflare are processors, some abroad. Unconfirmed whether any transfer restriction applies today; keep a list and contracts.

## Risks and unknowns
- Official Act and Rules text not read; section references and Rule details are secondary.
- Startup exemptions, log retention period, language rule and any notified transfer restrictions: Unconfirmed.
- The in-house retention periods (24 months for the waitlist) are not derived from law.
- Penalty numbers are maxima from commentary, not what would be imposed.

## What I would do next
1. Founder: decide the age rule (my recommendation above) and create the privacy mailbox before launch.
2. **Request to Back end:** add `watches` to account deletion and the privacy table; confirm community content is removed on delete; write the breach runbook with Main.
3. **Request to Front end:** standalone consent notice wording and an age question at sign-up (after the founder decides).
4. R&D: once someone with a normal browser can open the official Rules, confirm the 72 hours, log retention, language and startup points, and tighten the Unconfirmed rows.
5. A lawyer to review everything above before public launch.
