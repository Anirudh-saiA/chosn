# Database backup: how it works and how to restore

Approved by the founder on 2026-10-22 (see `backup-plan.md`). Built and tested the same day.

## What runs
| Piece | File |
|---|---|
| Daily backup, 04:30 | `scripts/backup_db.py`, Windows task **CHOSN database backup** (`scripts/register-backup-task.ps1`) |
| Restore test (once, then monthly) | `scripts/restore_test_db.py`, run by hand |
| Destination | `D:\chosn-backups\daily\chosn-<date>.dump`, Sundays also `weekly\chosn-<date>.dump` |
| Retention | 7 daily + 4 weekly. Files beyond that are only **listed** until the task is registered with `-Prune` |
| Log / result | `logs/backup-<date>.log`, `data/daily/backup_last_run.json`, `logs/restore-test-<date>.log`, `data/daily/restore_test_last_run.json` |

The backup is `docker exec chosn-postgres-1 pg_dump -Fc` (read-only for the database). It logs in through the container's own socket, so **no password is read, passed or printed**. It waits while the nightly import holds `data/daily/run.lock`, refuses to start with too little free space on D:, checks the new dump with `pg_restore --list`, flags a dump under half the size of the previous one, and only then renames `.partial` to `.dump`. A failed run leaves the older dumps alone and exits non-zero. Settings can be overridden with `CHOSN_BACKUP_DIR`, `CHOSN_PG_CONTAINER`, `CHOSN_PG_DB`, `CHOSN_PG_USER`.

## Founder: two things to do once (admin rights needed)
`D:\` only lets administrators create folders, so the folder could not be created from the agent session.

1. In an **administrator** PowerShell, create the folder and let your account write to it:
```powershell
New-Item -ItemType Directory D:\chosn-backups; icacls D:\chosn-backups /grant "${env:USERDOMAIN}\${env:USERNAME}:(OI)(CI)M"
```
2. After `team/nightly` is merged, in a normal PowerShell in the main checkout (`C:\Users\aniru\OneDrive\Desktop\chosn`):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1
Start-ScheduledTask -TaskName 'CHOSN database backup'   # first real backup now (about 1 to 2 minutes)
```
When you are happy to let it delete old dumps, register again with `-Prune`:
`powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1 -Prune`

## Restoring (disaster)
Into a new database, never over a live one you still need:
```powershell
docker exec chosn-postgres-1 psql -U postgres -c "create database chosn_restored"
Get-Content D:\chosn-backups\daily\chosn-<date>.dump -AsByteStream | docker exec -i chosn-postgres-1 pg_restore -U postgres -d chosn_restored --no-owner
# if pg_restore reports one failed "REFRESH MATERIALIZED VIEW public.catalog_stats_mv" (known, see below):
docker exec chosn-postgres-1 psql -U postgres -d chosn_restored -c "refresh materialized view public.catalog_stats_mv"
```
(In Windows PowerShell 5.1 use `cmd /c "docker exec -i chosn-postgres-1 pg_restore -U postgres -d chosn_restored --no-owner < D:\chosn-backups\daily\chosn-<date>.dump"` because `-AsByteStream` does not exist there.) Then point `DATABASE_URL` at it, or rename it.

## Test result, 2026-10-22
Backup and restore were run for real against `chosn_dev` (the dump went to a test folder on C: because D: was not writable; nothing is left in it).
- Dump: **431.3 MB in 70 s**, `pg_restore --list` reads 390 entries. (The plan measured 378 MB earlier; the table keeps growing.)
- Restore into scratch database `chosn_restore_test`: **305 s**, then refresh of the materialized view; the scratch database was dropped afterwards (only the databases `chosn_dev`, `postgres`, `template0/1` remain).
- Row counts, all 53 tables: **50 identical, 3 with the live database slightly ahead** (`price_snapshots` +456, `price_snapshots_2026_10` +456, `drop_scheduler_runs` +16: rows written by the news cycle and the drop scheduler after the dump), none missing, none lower in live. Examples that matched exactly: `daily_best_prices` 2,098,758; `market_summaries` 470,364; `manual_price_entries` 2,791,405; `sneakers` 39,055; `users` 2.

## Finding for Back end (database owner)
`pg_restore` fails to refresh the materialized view `catalog_stats_mv`: it refreshes with an empty `search_path`, and the SQL function `effective_price_inr` calls `fx_rate_to_inr(...)` without its schema name (`public.`). The data is complete anyway; the restore script refreshes the view afterwards and reports it. Suggested fix: schema-qualify the call (or `SET search_path = public` on those functions) in a migration. Until then a real restore needs the extra `refresh materialized view` line above, and `pg_restore --exit-on-error` must not be used.

## Not checked
- The scheduled task itself (not registered: the folder does not exist yet and it must point at the main checkout, not this worktree), so the 04:30 trigger, battery and catch-up behaviour are untested; they copy the news task's settings.
- Retention pruning was not run (nothing old exists); the Sunday weekly copy was not exercised (today is a Thursday).
- That D: is a separate physical disk from C:, and there is **no off-PC copy yet** (the founder has not chosen where).
- The behaviour of waiting on `run.lock` while a real import runs (the lock logic is copied from `daily_update.py`).
