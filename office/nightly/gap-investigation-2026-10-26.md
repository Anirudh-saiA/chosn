# Price-history gaps: investigation, 2026-10-26

Asked by Data via Main. Read-only investigation (Windows event logs, task and power settings, logs, `data/webscraper/state.json`, the database). I ran **no scraper and no scheduled task**; I changed no pause, no pacing and no Windows setting.

## Coverage per IST day (from the database, `nightly_health.py` now prints this every morning)
| Day | Rows | Stores | Core stores missing | Cause |
|---|---|---|---|---|
| 19 Oct | 418,704 | 10 | none | |
| 20 Oct | 422,181 | 11 | none | |
| 21 Oct | 883,918 | 11 | none | two imports that day (a failed 02:00 full run, then re-runs at 10:09 and 11:31): row count doubled, not a gap. Puma scrape died in Modern Standby (03:28-07:22) |
| 22 Oct | 448,594 | 10 | none | 02:00 job missed (PC shut down 00:39-01:44, then Modern Standby), caught up by hand 11:07 |
| 23 Oct | 422,564 | 9 | Superkicks, Crepdog, Limited Edt | HTTP 429 at 02:02, 02:05, 02:13: pause 24 h |
| 24 Oct | 428,215 | 6 | Superkicks, Crepdog, Limited Edt, Gully Labs | the three 23 Oct pauses ended at 02:02, 02:05, 02:13, after the 02:00 start; Gully Labs got a 429 at 02:02 |
| 25 Oct | **0** | 0 | all | PC shut down, see Q1 |
| 26 Oct | 495,467 | 11 | Gully Labs | Gully Labs paused by a 429 at 11:53 on 25 Oct (not from the nightly, see Q2) |

## Q1. 25 Oct: did the 02:00 job run?
**No.** There is no `logs/daily-2026-10-25.log`, and `data/daily/2026-10-25/` does not exist.
- **The PC was shut down, not asleep.** System log: user-initiated shutdown **00:16**, boot **11:30** (11 h 14 min off). The 01:00 weekly and the 02:00 daily could not fire. (22 Oct was the same: shutdown 00:39, boot 01:44.)
- **On battery the whole time.** Kernel-Power event 105: `AcOnline=false` at 00:15 and again at 11:30; AC returned at 13:55.
- **The catch-up did not happen.** After boot, the *backup* task ran its missed 04:30 run at 11:38 (it allows battery) and the news cycle ran at 11:37. The daily and weekly tasks, which are set to `DisallowStartIfOnBatteries=True`, left no log at all, and the weekly has still never run (`LastRunTime` 1999, next 1 Nov). The battery block is the most likely reason, **but it is not proven**: the news task has the same block and still ran at 11:37. The Task Scheduler history log is switched off on this PC (`Microsoft-Windows-TaskScheduler/Operational` is disabled), so there is no record of what the scheduler decided. To keep a record from now on (needs an administrator PowerShell, I did not do it): `wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true`.
- **Other nights:** Modern Standby spans 02:00 on 19 Oct (03:12-09:22), 20 Oct (02:49-08:18) and 21 Oct (01:06-07:22 with a 03:28 re-entry). The 19th and 20th still completed; on the 21st the Puma scrape died. 23, 24 and 26 Oct had no sleep at night.
- **Wake timers are off on battery.** `powercfg` wake timers: AC enabled, **battery (DC) disabled**. So even after the fix is applied, `WakeToRun` will not wake a sleeping laptop that is on battery; it only helps on AC. Founder, one command (a system power setting, so not done by me): `powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1` then `powercfg /setactive SCHEME_CURRENT`.
- **A shut-down PC cannot be fixed by any setting.** Shutdown at night on battery loses the run unless the catch-up fires at the next boot. With the fix applied (start on battery allowed), the missed 02:00 run starts when the user next signs in.

## Q2. 429 pauses and the start time
**Yes, there is a built-in two-day cycle.** The pause is 24 h from the moment of the refusal (`state.json`: `until` = `at` + 24 h). The refusal always happens *after* the job started, so a job that starts at the same clock time the next day always finds the pause still on for a few minutes:

| Store | 429 at | Pause ends | Next job starts | Result |
|---|---|---|---|---|
| Limited Edt | 23 Oct 02:02 | 24 Oct 02:02 | 24 Oct 02:00 | skipped |
| Superkicks | 23 Oct 02:05 | 24 Oct 02:05 | 24 Oct 02:00 | skipped |
| Crepdog Crew | 23 Oct 02:13 | 24 Oct 02:13 | 24 Oct 02:00 | skipped |

Starting later fixes only a 429 that comes within the first few minutes; a 429 at 04:25 (thaely.com, a homegrown-brand site read by the brand scan) or later would still lose the next day. So I changed the **job**, not the start time (written, tested on a fake state file, not yet run for real):

- `scripts/daily_update.py`: at the end of the scrape stage (at least 25 to 30 minutes after the start), a store that failed with exit 3 is asked **once more** if, and only if, its recorded pause has already run out (`pause_ended()`). A pause still on, a fresh 429 this run, an unreadable pause file, or any other failure is left alone. The pause is never cleared, shortened or bypassed, pacing is untouched, a store is retried at most once per run, and the retry is logged and recorded in `last_run_summary.json` (`retried_after_pause`). The scraper itself still refuses if the site is paused.
- The cleaner fix, **for the Data team to decide**: these 429s cluster after long full runs. The nightly was in full mode (no `--quick`, see below), and on 25 Oct between 11:53 and 14:07 **six more sites got a 429** (Gully Labs 11:53, Neemans 13:55, Baccabucci 13:58, CHNKS 14:01, Almost Gods 14:03, Red Tape 14:07). `logs/daily-2026-10-25.log` does not exist, so those requests did **not** come from the nightly job: someone ran scrapers by hand that day (the brand scan at 13:55-14:07, Gully Labs at 11:53). That by-hand Gully Labs run caused the 26 Oct Gully skip. I do not know who ran them. Rule going forward: by-hand scraper runs go through the nightly job or are announced to Nightly first, because every refusal costs the next night.

## Q3. Settings so a missed run starts as soon as possible
Written and merged earlier (`register-daily-task.ps1`, `register-news-task.ps1`), **still not applied** (verified 26 Oct): the tasks still block on battery, stop on unplug, do not wake the PC, do not retry; `run-daily.cmd` still has no `--quick` (the 02:00 job ran 146 to 155 minutes in full mode on 23, 24 and 26 Oct). Apply from the main checkout:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-daily-task.ps1
powershell -ExecutionPolicy Bypass -File scripts\register-news-task.ps1
```
plus the wake-timer line above for battery. New in this branch: `daily_update.py` now asks Windows to stay awake while it runs (`SetThreadExecutionState`, ends with the process, changes no setting), which covers the 21 Oct case (a sleep in the middle of a scrape).
The weekly task has never run, and the daily has been running in full mode, so the weekly is currently redundant; once `--quick` is restored it matters again (Sundays 01:00).

**Catch-up for 25 Oct: not useful, and I did not run one.** A price snapshot records the price at the moment it is fetched; yesterday's prices cannot be fetched now. 25 Oct is a permanent gap. Mark it as missing (the health report and the table above do), never as "unchanged".

## Q4. A check that fails loudly
Done: `scripts/nightly_health.py` now has a "Price history coverage" section (last 8 days, rows and stores per IST day). A day with no rows, or missing any core store (Superkicks, Crepdog Crew, Mainstreet Marketplace, Limited Edt, Gully Labs, Culture Circle), is **RED** at the top of the morning report. `--strict` makes the script exit 1 when anything is red, so a scheduled run can fail visibly. Run for 26 Oct it reports the real history: 23 Oct partial, 24 Oct partial, 25 Oct no data, 26 Oct partial. Today's day is counted only after 06:00.
Not done: the 08:00 scheduled run of the health script (a new Windows task; I will not register it without the founder's word).

## What I ran, what I did not check
Ran: Windows event-log reads, `Get-ScheduledTask(Info)`, `powercfg /query`, database SELECTs, log reads, `nightly_health.py` for 26 Oct, and a unit test of `pause_ended()` against a fake state file. Did **not** run any scraper or the nightly, apply any Windows change, or test the retry pass inside a real run (it needs a real paused store; the first real test is the next night after a 429). Did not find who ran the by-hand scrapes on 25 Oct. Did not check why the daily and weekly catch-up did not fire (no scheduler history). 
