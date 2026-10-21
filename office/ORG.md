# CHOSN office

CHOSN is a sneaker price-comparison, drops and news site for India. This folder is how the team works. Every team is its own Claude session in the CHOSN
group; each reports to the Founder/CEO session ("Main"), where the major work and every decision happens. The full company structure, with the roles a startup needs and when each starts, is in `office/STRUCTURE.md`.

## Who does what

| Team | Owns | Reports on |
|---|---|---|
| **Founder/CEO (Main)** | Priorities, merging, pushing, releases, every external action | Everything |
| **Drops and News desk** | Drop calendar data, news feeds, tagging, pictures, The CHOSN Times issues, the 10-minute news cycle | New drops, feed health, what published, what is stale |
| **Outreach** | Finding events, programmes, competitions, grants and people in founder, sneaker and fashion worlds; drafting messages | Opportunities with deadlines, drafts waiting for the founder to send |
| **Data team** | Store scrapers, pairing, price history, the nightly price import, the Buy now / Wait outlook log, and the datasets for the models trained after 60 to 90 days (price prediction, legit check, sell now / later and how much) | Pipeline health, rows collected, data quality, what each dataset still lacks |
| **R&D (research)** | Research on everything: technology and costs, competitors, data sources, law and compliance, product ideas. Short, sourced answers with a recommendation | Questions answered, questions waiting, decisions needed |
| **AI/ML team (dormant)** | Later: the price forecast, sell now/later and legit-check models, after about 60 to 90 days of data (`roles/aiml.md`) | Experiments against the baseline, missing data |
| **Security team** | Finding and proving weaknesses in our own app, API, database, jobs, dependencies and secrets; privacy controls; checking fixes | New findings by severity, fixes verified, what was and was not tested |
| **Front end** | `apps/web`: every page, component, the magazine's look and reader, mobile, speed, accessibility | UI shipped, bugs, screenshots |
| **Back end** | `apps/api`: endpoints, database migrations, auth, queues, email, tests, deployment files | API shipped, tests, performance, security |

## Rules for every team

1. **Stay in your lane.** Edit only the files your team owns (see your role brief). Need a change elsewhere? Write it in your report as a request.
2. **Branch, push your branch, never merge.** Work on your own branch (`team/<name>`) in your own worktree. When a task is done, commit and push **only that branch**, then send Main a review request (`REVIEW: team/<name>: ...`). Nobody pushes or merges into `develop` or `main` except Main, and only after the founder says "approve" (merge) and "push" (push).
3. **Honest data.** Every date and price carries its source and how firm it is (Confirmed, Reported, Unconfirmed). Nothing is invented, and publisher text is never copied. Prices are in rupees.
4. **No outward actions without the founder:** no e-mail, no sign-ups, no purchases, no posting, no payments, no keys pasted into chat.
5. **Secrets stay secret.** Never print or commit `.env` contents.
6. **Say what you tested.** Reports state what was run and what passed or failed, and say plainly what was not checked.
7. **Small steps, tested.** Typecheck, lint and tests pass before a task counts as done.

## The review gate (how work gets in)
```
Founder prompts a team directly  ->  team works on team/<name>, tests, commits, pushes its branch
  ->  team sends Main "REVIEW: team/<name>: ..."  ->  Main runs /review: lane, safety, typecheck, lint, tests, a look at the UI
  ->  Main tells the founder: APPROVE / CHANGES NEEDED / REJECT, with reasons
  ->  founder says "approve"  ->  Main merges into develop and re-runs the tests  ->  founder says "push"  ->  Main pushes
```
The control prompt each team receives is `office/prompts/control-prompt.md`. Reviews are written to `office/reviews/`.

## How work flows

```
Morning   Main writes office/daily/<date>.md       (the day's tasks per team, from logs, failures and the backlog)
          Founder assigns: pastes each team its tasks (or tells Main to send them)
Day       Each team does its tasks, updating office/tasks/<team>.md
Evening   Each team runs /team-report  ->  office/reports/<team>/<date>.md
Next day  Main reads the reports (/daily-brief), merges what is good, flags what is not
```

- Tasks: `office/tasks/<team>.md` (open, doing, done).
- Reports: `office/reports/<team>/<date>.md`, from `office/templates/report.md`.
- Handoffs of code or documents between teams: `handoff/<from>-<to>/` with a README saying what is in it and how to apply it, as the news desk did.
- Role briefs: `office/roles/<team>.md`. Paste a team's brief into its session as the first message.

## Limits to remember

A team is a session: it works only when it is open or scheduled, and starts without memory except these files. Keep the briefs and task files current.
