# Schedule review, 2026-10-22 (task 2)

Status: **fix written, not applied.** The sandbox refused every write to the Windows tasks and to `scripts/run-daily.cmd` ("account and standing-rule change" / "modify shared resources"), so nothing on the PC was changed. The founder (or Main with the founder's word) applies it with one command, below.

## What I found (read-only)

| Setting | Daily 02:00 | Weekly Sun 01:00 | News every 10 min |
|---|---|---|---|
| Runs as / logon | aniru, **Interactive** (only while signed in) | same | same |
| StartWhenAvailable (catch up a missed start) | yes | yes | yes |
| DisallowStartIfOnBatteries | **yes** (no start on battery) | **yes** | **yes** |
| StopIfGoingOnBatteries | **yes** (job killed on unplug) | **yes** | **yes** |
| WakeToRun | no | no | no |
| Time limit | 5 h | 5 h | 30 min |
| Overlap | IgnoreNew (+ `data/daily/run.lock`) | IgnoreNew (+ lock) | IgnoreNew (+ `news.lock`) |
| Restart on failure | no | no | no |
| Last result | **exit 1** (2026-10-21 02:00) | never run (first run Sun 2026-10-25 01:00) | running fine |
| Next run | 2026-10-23 02:00 | 2026-10-25 01:00 | every 10 min |

The before-state is the table above (a saved copy was not possible: the write was refused).

## Two real bugs found while reading the logs

1. **The 02:00 "quick" job has been running in full mode.** `scripts/run-daily.cmd` ends with `run.py all ` and no `--quick`. The cause is in `register-daily-task.ps1`: the helper had a parameter named `$args`, a reserved PowerShell variable, so `--quick` was silently dropped. Evidence: `logs/daily-2026-10-21.log` at 02:00 started Myntra, Puma and VegNonVeg too; Mainstreet took 325 minutes (27 minutes when run quick at 11:31) and the scrape stage ended at 07:34, past the 5 h limit. A "40 minute" job became a 5.5 hour job.
2. **Why 2026-10-21 02:00 ended in exit 1** (the actual failure): the pre-import validation refused 5 rows with an empty price (`clean.csv` lines 56052 to 56056, from the 341,175-row Mainstreet file of that full run); nothing was imported, which is the safety check doing its job. Puma India also failed that night (exit 1). **Hand-off to Data:** find which store/row has the empty price (rows 56052-56056 of `data/daily/2026-10-21/clean.csv`) and why Puma exits 1.

## The fix (written, in this branch)

- `scripts/register-daily-task.ps1`: renamed the parameter (so `--quick` reaches `run-daily.cmd` again); both tasks now allow start on battery, do not stop on unplug, wake the PC for the run, and retry twice 15 minutes apart if the job exits with an error. 5 h limit and IgnoreNew kept.
- `scripts/register-news-task.ps1`: allow start on battery, do not stop on unplug (no wake, the news job runs every 10 minutes anyway).

To apply (PowerShell, from the main checkout, after Main has merged this branch, or directly from the worktree `..\chosn-nightly` which has the same files):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-daily-task.ps1
powershell -ExecutionPolicy Bypass -File scripts\register-news-task.ps1
```

Then confirm `Get-Content scripts\run-daily.cmd` ends with `all --quick` and `Get-ScheduledTask 'CHOSN webscraper daily update' | Select -Expand Settings`. **Until it is applied, tonight's 02:00 run will again be a full run.** The quickest manual alternative is to append ` --quick` to the last line of `scripts\run-daily.cmd` (it is git-ignored, machine-local).

## What stays risky (cannot be fixed from here)

- **Signed out or shut down.** The tasks run only while aniru is signed in (Interactive logon). If the PC is off or at the sign-in screen at 02:00, the job starts when the user next signs in (that is how 2026-10-22 was lost: shut down 00:39, signed in about 10:45). Running "whether the user is logged on or not" needs the Windows password stored in the task, which I will not do; Docker Desktop also needs a user session. Mitigation: do not shut down at night (sleep or hibernate is fine now that the task wakes the PC), or turn on Windows automatic sign-in.
- **Sleep.** WakeToRun needs "Allow wake timers" enabled in the power plan (default on for AC, off for battery on some laptops).
- **Disk.** C: has about 11 GB free. A full disk fails the job silently; see the health report.
- **Permanent answer:** the move to a hosted runner (duty 7).
- Tomorrow 02:00: the daily task is scheduled (next run 2026-10-23 02:00, confirmed read-only), but as quick mode only once the fix is applied.
