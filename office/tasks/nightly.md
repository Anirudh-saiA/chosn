# Tasks: nightly

Owner: the nightly team. Main assigns; the team updates this file and reports each evening with /team-report nightly.
First assigned 2026-10-22.

## Open
1. **Run the missed nightly job.** The 02:00 job did not run on 2026-10-22 (the PC was shut down about 00:39 and not signed in again until about 10:45). Run the quick version now, watching the log, and report: stores scraped with row counts, minutes, anything that failed and why, and what is still stale afterwards. *Done when:* a run summary in your report.
2. **Fix the schedule so a missed run cannot be skipped silently.** Check the two Windows tasks (battery rules, start when available, time limits, what happens if the PC is signed out), change what is safe, and say what remains risky (a signed-out or powered-off PC). *Done when:* the settings are listed before and after, and tomorrow 02:00 is confirmed as scheduled.
3. **Morning health report.** Write `scripts/nightly_health.py` (read-only) that produces `office/nightly/health/<date>.md` from the logs, the summaries and the database (format in your brief, duty 1), and run it once for today. *Done when:* the file for today exists and is accurate.
4. **Database backup, propose first.** A written plan (where the dumps go, size, retention, how to restore and test it, time of day, what it needs) for the founder to approve before you build it. *Done when:* a one-page plan.

## Doing

## Done

## Founder rule 2026-10-27 (card rule-by-hand-scrapes, approved)
Any team that runs a scraper outside the nightly job tells Nightly first, or runs it through the nightly. Written into office/ORG.md. Reason: by-hand runs on 25 Oct returned 429 from six sites and Gully Labs was skipped on 26 Oct.


## FOUNDER-TASK 2026-10-27: register the schedule fix and the health task (assigned by the founder, via Main)
The founder told Main to give this to Nightly instead of running the commands by hand. Cards: apply-schedule-fix and morning-health-task (both approved by the founder on 26 Oct). The Nightly merge is in develop (6629550); use the repo at D:\CHOSN\chosn.
1. Run scripts\register-daily-task.ps1 and scripts\register-news-task.ps1 so the daily scrape and the news cycle start on battery and wake the PC.
2. Set the wake-timer setting on battery: powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1, then powercfg /setactive SCHEME_CURRENT.
3. Run scripts\register-health-task.ps1 (daily 08:00, read-only). Test with Start-ScheduledTask -TaskName 'CHOSN morning health report'.
Rules: all paths are on D:\CHOSN\chosn now (the C: path is only a link). Change nothing beyond these three steps. If a step needs administrator rights and your session has none, stop and report BLOCKED to Main with the exact command; do not work around it. Afterwards check with Get-ScheduledTask (battery and wake settings) and powercfg /query, and report DONE to Main with the output. Main then closes the two cards.

## FOUNDER-TASK 2026-10-27: 60-day data run, log after every run
Read office/data-run/60-day-run.md. Day 1 = 27 Oct 2026, day 60 = 25 Dec 2026. After every daily run add a row to office/data-run/LOG.md: date, day number, status, rows added, and the exact file or table where the data is stored. Missing day = MISSING, never filled. Fill the row for 27 Oct now from today's run (data/webscraper/last_run_summary.json). Report to Main when the row is written so Main can tell the founder.

## FOUNDER-TASK 2026-10-27: VegNonVeg prices (see office/tasks/data.md, same date)
Data fixes and checks the VegNonVeg scraper first. After Data's fix is merged, run the VegNonVeg read through the nightly script and report the new row counts. No pacing change.

