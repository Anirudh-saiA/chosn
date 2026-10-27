# Registers the database backup as a Windows Task Scheduler job:
#   CHOSN database backup    every day at 04:30    scripts\backup_db.py: pg_dump of chosn_dev to D:\chosn-backups, verified
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1            # register (or update)
#   powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1 -Remove    # unregister
#   powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1 -Prune     # also delete dumps beyond 7 daily + 4 weekly
#
# Runs as YOU, only while you are logged in, like the other jobs. Without -Prune the job only LISTS the dumps the retention rule
# would delete; register with -Prune once you have said yes to deleting old backups. If 04:30 was missed it starts as soon as the PC is
# on (StartWhenAvailable), battery power does not stop it, it never overlaps itself (IgnoreNew, plus a lock file) and it is stopped
# after 3 hours. The script itself waits while the nightly import holds data\daily\run.lock.
param([switch]$Remove, [switch]$Prune, [string]$At = '04:30')

$name = 'CHOSN database backup'
if ($Remove) { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "Removed '$name'."; exit 0 }

$root = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction Stop).Source
$pythonw = Join-Path (Split-Path -Parent $python) 'pythonw.exe'
if (-not (Test-Path $pythonw)) { $pythonw = $python }

$arg = 'scripts\backup_db.py'
if ($Prune) { $arg += ' --prune' }
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arg -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'CHOSN: daily pg_dump of the Postgres database to D:\chosn-backups, verified, 7 daily + 4 weekly (scripts\backup_db.py).' -Force | Out-Null

Write-Host "Registered '$name' (daily at $At$(if ($Prune) { ', pruning old dumps' } else { ', listing but not deleting old dumps' }))."
Write-Host "Logs: $root\logs\backup-<date>.log    Last run: $root\data\daily\backup_last_run.json"
Write-Host "Run one now:  Start-ScheduledTask -TaskName '$name'"
