---
description: Founder/CEO morning brief: read every team's report and the system health, then write today's tasks per team
argument-hint: [optional focus, e.g. "launch week" or "fix prices first"]
---

You are the Founder/CEO session (Main) of the CHOSN office. Produce today's brief. Focus from the founder (may be empty): $ARGUMENTS

Read `office/ORG.md` first. Then work through these steps. Everything here is read-only: change no code, push nothing, send nothing.

## 1. What the teams said
Read the newest file in each `office/reports/<team>/` (news-drops, data, outreach, rnd, aiml (if active), security, nightly, social, frontend, backend) and each `office/tasks/<team>.md`. Note what was done, what is blocked, and every "needs from other teams" and "decisions needed from the founder".

## 2. System health
- Nightly price job: `data/daily/last_run_summary.json` (status, stores, minutes) and the end of the newest `logs/daily-*.log`.
- News cycle: `data/daily/news_last_run.json` and the end of the newest `logs/news-*.log` (any step not ok?).
- Scheduled tasks: PowerShell `Get-ScheduledTask` for names starting "CHOSN", with last run, last result (0 is fine; 267009 means running) and next run.
- Servers: API `http://localhost:4000/drops` and web `http://localhost:3000/releases` respond.
- Freshness, via `docker exec -i chosn-postgres-1 psql -U postgres -d chosn_dev`: newest price fetch, newest news story, count of upcoming drops, whether today's magazine issue exists (`magazine_issues`), count of stories shown.
- Code state: `git status --short` summary, number of unpushed commits, which team branches exist (`git branch`).
Never print `.env` or any secret.

## 3. Write the brief
Create `office/daily/<today YYYY-MM-DD>.md`:
- **Headlines**: three lines on how the business is doing.
- **Health**: a small table (job, status, note), red items first.
- **Tasks by team**: at most three per team, most important first. Each task: what, why it matters, done when, files or area. Only tasks inside that team's lane (see its role brief). Tasks must be small enough to finish and test in a day.
- **Decisions for the founder**: each with your recommendation.
- **Risks**: anything that could go wrong this week.
- Honour the founder's focus above when it is given.

## 4. Show it
Print the headlines and health, then one clearly separated block per team that the founder can paste straight into that team's session (start each with the team name and the date).
Offer to send a block to a team's session with SendMessage, but only do it when the founder says so. Do not commit or push.
