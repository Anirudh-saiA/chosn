# Soft launch plan (Day 19, tasks 7–10)

## Status: prepared, not sent

Everything below is ready. The invite has **not** been sent, and cannot
be sent from here — see "What only you can do" at the bottom.

## Cohort (task 7)

**Recommendation: waitlist signups first**, and only them, for the first
round.

Reasoning, in order of weight:

1. **They already consented.** They gave an email address specifically to
   be told when access opened. Emailing them is the thing they asked
   for, not cold contact — which matters both for basic decency and for
   DPDP consent (the purpose they consented to is exactly this).
2. **They're the most forgiving cohort.** They opted in months before
   there was anything to see. Early-stage rough edges cost less
   goodwill here than with a paid-acquisition audience who arrived
   expecting a finished product.
3. **Paid acquisition now would measure the wrong thing.** With ~11
   sneakers in the catalog and price data from a partly-fixture
   pipeline, a paid test would measure the catalog's thinness, not the
   product's premise. That's an expensive way to learn something
   already known.

**Sequence:** waitlist → personal sneaker-community network (second
wave, once the first round's feedback is triaged) → paid acquisition
only after the catalog is genuinely deep enough to be judged fairly.

**Cohort size:** unknown from here. The production waitlist lives in the
Railway database; the local dev database has 0 rows. Get the real count
with, against production:

```sql
SELECT count(*) FROM waitlist_entries;
SELECT count(*) FROM waitlist_entries WHERE linked_user_id IS NULL;  -- not yet converted
```

If it's more than ~50, invite in batches of 20–30 rather than all at
once — a staggered send keeps the first 24h of monitoring legible and
means a bad bug doesn't reach everyone before you've seen it.

## Invite email copy

Subject: **Your CHOSN access is open**

> You joined the CHOSN waitlist to find out when we opened up. This is
> that email.
>
> CHOSN tracks sneaker prices across Indian retailers and global resale,
> and tells you whether now is actually a good time to buy — 30- and
> 90-day averages, current best price, and where it is.
>
> One thing worth being upfront about: **we don't sell sneakers.** We
> never take payment or hold stock. We show you where a pair is
> cheapest and send you to that retailer. Some of those links earn us a
> commission, at no extra cost to you — that never changes how offers
> are ranked, which is always cheapest-first.
>
> [Have a look →]
>
> It's early, and it looks it in places. If something's wrong, slow,
> confusing, or you just don't believe a number we're showing you —
> tell us: [send feedback]. That link is in the footer of every page.
> We read all of it.
>
> — CHOSN
>
> You're getting this because you joined the waitlist at chosn.app.
> [Unsubscribe]

Notes on the copy, since these are deliberate:

- The "we don't sell sneakers" paragraph is high in the email, not
  buried. Positioning confusion is the known blind spot (Day 1 onward),
  and the invite is the first chance to pre-empt it.
- Affiliate disclosure appears in the invite itself, not only on-site.
- It sets expectations low ("it's early, and it looks it") rather than
  overselling. Early testers forgive rough edges they were warned about.
- Feedback ask is specific about what's useful, and links the real form.

## Monitoring plan for the first 24–48h (task 9)

Treat this as a live-fire test of the alerting, not just the features.
The point is to find out whether you'd *notice* a problem, not only
whether one occurs.

**Watch, in priority order:**

| What | Where | What "bad" looks like |
| --- | --- | --- |
| API errors | Sentry (apps/api) | Any spike; anything in `/catalog/search` or `/trust-safety/*` |
| Signup funnel | PostHog | Visitors landing but not signing up; signup started → not completed |
| Waitlist → account conversion | Postgres | `waitlist_entries.linked_user_id` staying NULL across the cohort |
| Feedback volume/themes | `GET /feedback` (admin) | Repeated mentions of the same confusion |
| Price freshness | `GET /health/fetch` | Any retailer stuck "failed" — stale prices are the one error that damages trust directly |
| API uptime | Railway + `GET /health` | Non-200, or the postgres/redis checks failing |

**Known gap to watch for specifically:** PostHog now only receives
events from users who *accept* the consent banner. Funnel numbers will
undercount real usage, and the gap between DB reality (accounts,
waitlist rows) and PostHog counts is itself a useful signal about how
many people decline. Don't read low PostHog numbers as low traffic
without checking the database.

## Launch readiness checklist (task 10)

Verified on Day 19 against a real local build and running stack:

- [x] **Legal pages live** — `/terms`, `/privacy` build and render (200)
- [x] **Linked from every page footer** — verified on all 12 routes; caught and fixed a real miss on `/news`'s empty-state branch, which has its own early return
- [x] **Affiliate disclosure consistent** — single source in `lib/legal-copy.ts`, identical wording verified in rendered output on both a price page and a footer
- [x] **Consent banner works and actually gates tracking** — `posthog` appears nowhere in the initial page payload; the import only runs after consent is granted
- [x] **Consent defaults to privacy-preserving** — undecided is treated as denied; no pre-checked box
- [x] **Age statement on signup** — 13+ stated, with Terms/Privacy links, verified in rendered HTML
- [x] **Account deletion tested end to end** — real account with waitlist + subscriber + subscription rows, all erased, session revoked (see docs/legal/README.md for the before/after row counts)
- [x] **Feedback path works end to end** — real POST stored and read back from Postgres
- [ ] **Legal pages reviewed by a lawyer** — NOT DONE, blocking public launch (not soft launch)
- [ ] **Monitoring actively watched** — requires the launch to actually happen
- [ ] **Invite sent** — requires you

## What only you can do

1. **Get the real cohort size** from the production database (queries above).
2. **Set up the mailboxes** — `hello@chosn.app` and `privacy@chosn.app` are referenced in the Terms, Privacy Policy, and invite copy, and neither exists yet. The Privacy Policy names the second as the grievance contact; it must be real and monitored.
3. **Send the invite.** I can't send email to real people — Resend is configured in code but sending a real campaign to real addresses is your call and your account.
4. **Get the legal review.** Nothing else on this list matters as much before a *public* launch.
5. **Watch the dashboards** for the first 24–48h. I can help triage anything that comes back.
