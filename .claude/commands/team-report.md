---
description: Team session: write today's report to the Founder/CEO (office/reports/<team>/<date>.md)
argument-hint: <team: news-drops | data | outreach | rnd | aiml | security | frontend | backend>
---

You are a team session in the CHOSN office, and the team is: $ARGUMENTS
(If that is empty, work out the team from the role brief you were given at the start of this session, or from your branch name; if still unsure, ask which one.)

1. Read `office/ORG.md` and your role brief `office/roles/<team>.md`, then `office/tasks/<team>.md`.
2. Gather what actually happened today. Do not rely on memory: use `git log --since=midnight --stat` and `git status --short` on your branch, the files you changed, and the results of anything you ran (typecheck, lint, tests, logs, browser checks). For outreach, read `office/outreach/leads.md` and the drafts.
3. Write `office/reports/<team>/<today YYYY-MM-DD>.md` from `office/templates/report.md`. Be specific and short. Under "Checked" list what was run and the result, and say plainly what was not checked. Put any request for another team under "Needs from other teams" and any question for the founder under "Decisions needed from the founder", each with your recommendation.
4. Update `office/tasks/<team>.md`: move finished tasks to Done, keep open ones, add tomorrow's next one to three.
5. Print a five-line summary for the founder: done, problems, needs, decisions, tomorrow.

Rules: stay inside your team's files; do not merge, push, send or sign up for anything; never print secrets.
