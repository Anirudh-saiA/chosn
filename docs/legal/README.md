# Legal pages — status and review checklist (Day 19)

## ⚠️ Nothing here has been reviewed by a lawyer

Both `/terms` and `/privacy` were drafted in-house on Day 19 and carry a
visible "pending legal review" notice on the page itself. They are a
**starting point for a lawyer to correct**, not a substitute for one.
This is stated on the live pages rather than only in this file so a
visiting user isn't misled about their status either.

Do not remove those notices until the items below are signed off.

## What specifically needs a lawyer, and why

Ordered by how likely it is to be wrong, not by where it appears.

### 1. DPDP Act 2023 specifics (highest risk)

The Privacy Policy is written against India's DPDP Act, but several
provisions need someone who actually practises under it:

- **Grievance officer.** The Act requires a named, contactable grievance
  officer. The page currently names "the founder" at
  `privacy@chosn.app`. Whether that satisfies the Act's requirements for
  a Data Fiduciary of CHOSN's size — and whether that mailbox needs to
  exist and be monitored before launch (it does not exist yet) — needs
  confirming.
- **Significant Data Fiduciary status.** If CHOSN is ever classified as
  one (volume/sensitivity thresholds set by the Government), additional
  obligations attach — DPIA, independent auditor, a resident Data
  Protection Officer. Nothing in the current draft addresses that.
- **Consent notice wording.** The Act has specific requirements about
  the notice given at the point of consent, including availability in
  the Eighth Schedule languages. The current consent banner and signup
  copy are English-only.
- **Children's data.** The draft states 13+ and says under-13 accounts
  aren't offered. The DPDP Act's threshold for children is **18**, with
  verifiable parental consent required below that, and a prohibition on
  tracking/behavioural advertising directed at children. A 13+ policy
  with analytics enabled may not be sufficient for 13–17 year olds under
  the Act. **This is the single most likely thing in these documents to
  be legally wrong**, and it matters because sneaker/streetwear skews
  young. Needs a real answer before public launch.

### 2. Liability, warranty, and jurisdiction (Terms)

The Terms disclaim price accuracy and state CHOSN isn't a party to any
transaction — which is factually correct and is the substance that
matters. What's missing is the boilerplate a lawyer would insist on:
limitation of liability, indemnity, governing law, dispute resolution
and venue. These were deliberately not invented here; badly-drafted
liability language is worse than none.

### 3. Affiliate disclosure sufficiency

Copy is now consistent (see below) and states the commission
relationship plainly. Whether it satisfies ASCI guidelines for
influencer/affiliate disclosure in India, and any obligations under
the individual affiliate programme agreements (Flipkart, Admitad,
INRDeals, Awin), hasn't been checked against those contracts.

### 4. Retention periods

The retention column in the Privacy Policy states real, specific
periods, but they were chosen as reasonable defaults, not derived from
a legal requirement or an actual data-lifecycle review. Notably: "24
months after launch" for unconverted waitlist emails is a number picked
here, not a mandated one.

## Affiliate disclosure — consistency fix (task 3)

**Before:** two independently written paragraphs saying overlapping but
non-identical things —
`components/pricing/AffiliateDisclosure.tsx` (Day 10) and
`components/landing/LandingFooter.tsx` (Day 18).

**Now:** one source, `lib/legal-copy.ts`, with two forms that make the
same claims in the same words:

- `AFFILIATE_DISCLOSURE_LONG` — price pages (next to the offer table)
  and quoted verbatim in the Terms.
- `AFFILIATE_DISCLOSURE_SHORT` — site footer and landing footer. A
  strict subset of LONG, dropping only the price-staleness sentence,
  because footers appear on pages with no live price data to be stale.
- `NOT_A_MARKETPLACE` — the Day 1 positioning boundary, stated
  identically everywhere it appears.

Changing the disclosure now means editing one file, not hunting three.

## Cookies: essential vs non-essential (task 4)

This split is what the consent banner enforces, and the Privacy Policy
describes it in the same terms.

**Essential — not gated, cannot be declined:**

| Item | Purpose |
| --- | --- |
| `authjs.session-token` cookie | Login session. httpOnly, secure, sameSite. |
| `authjs.csrf-token` cookie | CSRF protection on auth endpoints. |
| `chosn-analytics-consent` (localStorage) | Remembers the consent choice itself. |
| Notification subscriber id (localStorage) | Ties a browser to its own notification subscriptions. |

**Non-essential — off unless explicitly allowed:**

| Item | Purpose |
| --- | --- |
| PostHog cookies + localStorage | Product analytics. |

The gate is real, not cosmetic: `lib/analytics.ts` only calls
`import('posthog-js')` after consent is `granted`. With consent
undecided or denied, the module is never imported, so no analytics code
executes and no request reaches PostHog. Verified on Day 19 by
confirming the string `posthog` appears nowhere in the initial page
payload.

CHOSN runs no advertising or retargeting pixels at all, so there is no
third category.

## Erasure (task 6) — implemented and tested

Self-serve, at `/account/security` → "Delete account", backed by
`POST /api/auth/delete-account`.

The non-obvious part is documented in that route's own comment: the
schema's foreign keys alone do **not** fully erase someone.
`subscribers.user_id` and `waitlist_entries.linked_user_id` are
`ON DELETE SET NULL`, so deleting the `users` row would leave the
person's email address sitting in two other tables while telling them
they'd been deleted. Both are explicitly deleted, matched on email, in
the same transaction.

Tested end to end on Day 19 against a real account with a waitlist
entry, a subscriber record, and a notification subscription all sharing
one email:

```
rows BEFORE:  users: 1   waitlist: 1   subscribers: 1
rows AFTER:   users: 0   waitlist: 0   subscribers: 0   orphan subs: 0
```

The session token is also revoked (Day 16's Redis denylist) so a JWT
minted moments before deletion can't keep making authenticated calls —
confirmed by `/api/auth/session` returning `null` immediately after.

## Still outstanding before public launch

- [ ] Lawyer review of both documents, especially the four DPDP items above
- [ ] Decide the real minimum age (13 vs 18) with counsel — currently 13
- [ ] Create and monitor `privacy@chosn.app` and `hello@chosn.app` (neither exists)
- [ ] Confirm affiliate disclosure against each affiliate programme's own contract
- [ ] Decide whether a consent notice is needed in languages beyond English
