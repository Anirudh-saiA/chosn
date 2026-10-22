# Database backup plan (task 4): APPROVED 2026-10-22, built; see `backup.md` for how it works and the test result

Why: the price history (`price_snapshots`, `daily_best_prices`, `market_summaries`) cannot be re-scraped. Today the only copy is the Docker volume of `chosn-postgres-1` on this PC (database `chosn_dev`, **2.98 GB**). A deleted volume, a Docker reset or a failed disk loses all of it.

## Proposal

| Question | Answer |
|---|---|
| What | `pg_dump -Fc` (compressed custom format) of `chosn_dev`, run inside the container (`docker exec chosn-postgres-1 pg_dump ...`), streamed to a file. Read-only for the database. |
| Where | `D:\chosn-backups\` (D: has 346 GB free; C: has only 11 GB, and the repo lives under OneDrive, so dumps must not go in the repo). Files: `daily\chosn-<date>.dump`, `weekly\chosn-<date>.dump`. |
| Size | Measured today (a real `pg_dump -Fc` streamed to a counter, nothing written): **378 MB in 61 seconds**. 7 daily + 4 weekly = about 4.2 GB, growing with the history (the table gains about 440k rows a day, so expect roughly 5 to 8 GB after a few months). |
| When | 04:30 daily, after the 02:00 nightly job and its import normally finish (quick mode takes about 55 minutes). The script waits while `data/daily/run.lock` is held, so it never dumps in the middle of an import. A second run if the 02:00 job was caught up late. |
| Retention | Keep the 7 newest dailies and 4 newest weeklies (the Sunday dump is copied into `weekly\`). Pruning deletes only files in `D:\chosn-backups` that are older than the rule, and only after the new dump was verified. **The first prune needs your word, because it deletes files.** |
| Verify every run | `pg_restore --list` on the new dump (proves it is readable) and a size sanity check (not less than 50% of yesterday). The result goes into the morning health report. |
| Restore test (once, then monthly) | Create a scratch database `chosn_restore_test` in the same container, `pg_restore` the newest dump into it, compare row counts of the main tables with the live database, then drop **only** the scratch database. Never touches `chosn_dev`. |
| Off-PC copy | D: may be the same physical disk as C: (to be checked). A second copy outside this PC (external drive, or cloud storage you choose) is the real protection; I do not upload anything without your decision. |
| Needs | The script `scripts/backup_db.py` plus a third Windows task `CHOSN database backup` at 04:30 (same settings as the others), about 150 lines. Docker running. Free space on D:. |
| Cost to you | Nothing now. |

## What I need from you

1. Approve D:\chosn-backups as the destination (or name another).
2. Approve 04:30 daily, 7 daily + 4 weekly.
3. Say whether you want an off-PC copy and where.
4. Say "yes, create the scratch database" for the restore test (it creates and drops `chosn_restore_test`, nothing else).

Not checked yet: whether D: is a separate physical disk; the Postgres version match for restore (container is `postgres:16-alpine`, restore must use the same container's `pg_restore`, which the plan does).
