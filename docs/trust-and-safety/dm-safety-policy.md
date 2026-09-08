# DM/contact safety policy (Day 17, task 4)

**Status: binding spec, not yet implemented.** CHOSN has no direct
messaging today — this document exists so that whenever a later phase
ships DMs, they launch already correct, instead of shipping the "obvious"
open-by-default version and bolting on limits after the first harassment
incident. Treat every rule below as a requirement on that feature's
launch, not a suggestion to revisit.

## Why this is written now

The concrete risk is specific to CHOSN, not generic: a member's price-
tracking and collection activity is a real signal of income and,
sometimes, location (see [Community
Guidelines](../../apps/web/src/app/community-guidelines/page.tsx#L1)'s
doxxing section). An open-by-default DM system on a platform where
that's the subject matter is a cold-contact harassment and targeting
vector from day one, not a hypothetical one. The fix is default
configuration, decided before the incentive to ship fast overrides it.

## The default policy

1. **DMs default to closed for cold contact.** A new or unverified
   account cannot send a first message to someone who hasn't already
   interacted with them (following, a prior reply, or an explicit
   "message requests" opt-in the recipient controls). This is the
   single most important rule in this document — everything else is
   secondary to not allowing unsolicited first contact by default.

2. **"Unverified" means:** email not confirmed, account created within
   the last 7 days, or — once it exists — a lower trust tier based on
   report history. An account that has an *actioned* report against it
   (see `reports.status = 'actioned'` in the schema this Day shipped)
   drops to the same restricted tier regardless of account age.

3. **Rate limits on cold-contact messages**, once a recipient has opted
   into receiving them at all: a sliding-window limit (same algorithm
   as Day 16's login rate limiter, `apps/web/src/lib/auth/rate-limit.ts`
   — Redis sorted sets, fails closed) on *distinct recipients* a sender
   can cold-message per day, not just total message volume. A limit on
   total messages doesn't stop one account from spraying first-contact
   messages at fifty different people; a limit on distinct new
   recipients does. Suggested starting point: 10 distinct cold-contact
   recipients per rolling 24h for a verified account, 0 for an
   unverified one (i.e., unverified accounts cannot cold-contact at
   all — they can only reply within an already-open conversation).

4. **Every DM surface must consult `BlocksService.isBlockedEitherWay`**
   (`apps/api/src/trust-safety/blocks.service.ts`) before allowing a
   message to send or a conversation to render. This is not a UI-only
   filter — the send endpoint itself must check and reject, since a
   block that only hides messages client-side while still delivering
   them server-side isn't a block a determined harasser can't route
   around.

5. **A recipient can revoke an open conversation at any time** —
   opening a DM to someone (by replying, or by following them) is not a
   standing grant; the recipient's "message requests" setting and block
   list both take effect on the *next* message attempt, not just future
   conversations.

6. **Reporting a DM uses the existing generic report API** — `POST
   /trust-safety/reports` with `reportedEntityType: 'message'` — no new
   reporting system, per Day 17 task 1's own point.

## What "closed by default" does *not* mean

It doesn't mean DMs are opt-in-only forever, or that this makes CHOSN
unable to support real conversation once trust is established. It means
the *first contact* from a stranger is gated; once two accounts have a
mutual, established relationship (however that ends up being defined —
mutual follows, a prior public interaction, etc. — a decision for
whoever designs the actual DM feature), normal messaging between them is
unrestricted by this policy.

## Non-negotiable at launch

A DM feature does not ship without: (1) the cold-contact default above,
(2) the block-check on the send path, (3) a working report action for
messages using the existing API. If time pressure means cutting scope
when this feature is actually built, cut something else — these three
are the reason this document exists.
