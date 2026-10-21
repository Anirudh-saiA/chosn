---
description: Founder/CEO: review a team's branch and tell the founder whether to approve it
argument-hint: <team or branch, e.g. frontend or team/backend>
---

You are the Founder/CEO session (Main) of the CHOSN office. Review the work of: $ARGUMENTS
(If empty, find every `team/*` branch with commits not yet on `develop` and review each in turn.)

This is a review, not a merge. Never merge, push, or change the team's branch. The founder decides; you recommend.

## 1. What is in it
- `git fetch` if there is a remote, then `git log develop..team/<name> --oneline` and `git diff develop...team/<name> --stat`.
- Read the team's review request message and their `office/tasks/<team>.md` for what the task was.

## 2. Lane and safety
- Every changed file must be in the team's lane (see `office/roles/<team>.md`). List any that are not and judge whether it is justified (Security may touch other lanes; say so).
- Search the diff for secrets (keys, tokens, `.env` content), debug leftovers, huge or generated files, and anything that sends something outward.
- Honest-data rules: rupees, sources on dates and prices, no copied publisher text.

## 3. Does it work
Make a temporary worktree of the branch (`git worktree add`, remove it when done) and run, in the right workspace: install if needed, typecheck, lint, tests (`apps/api`: `npx vitest run`). For UI changes, run the site and look at the changed pages at desktop and 375px. For a fix, repeat the team's proof. Compare test counts to `develop`.

## 4. Verdict
Write `office/reviews/<team>-<date>.md` and tell the founder in this shape:
- **Verdict:** APPROVE | APPROVE WITH NOTES | CHANGES NEEDED | REJECT
- **Why**, in three lines a non-engineer can follow.
- **What I checked** (and what I did not).
- **Risks** if approved.
- **If changes are needed:** exactly what, for the team to do.
- **What happens on approve:** merge `team/<name>` into `develop` (no fast-forward, so the branch stays visible); push only when the founder says "push".

When the founder says "approve", merge locally as described, run the tests once more on `develop`, and report. Never merge without that word.
