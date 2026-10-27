# Registers the morning health and coverage check as a Windows Task Scheduler job:
#   CHOSN morning health report   every day at 08:00   runs scripts\nightly_health.py --strict
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-health-task.ps1            # register (or update)
#   powershell -ExecutionPolicy Bypass -File scripts\register-health-task.ps1 -Remove    # unregister
#
# What it does: reads the logs, the run summaries, Docker and the database (SELECT only) and writes office\nightly\health\<date>.md,
# including the price-history coverage table (rows and stores per day). A day with no rows or a missing core store is RED at the top.
# With --strict the task ends with exit code 1 when anything is RED, so "Last Run Result" in Task Scheduler shows the failure.
# It runs no scraper, changes no data and sends nothing. Needs Docker running for the database part (it reports "database could not be
# read" in red when Docker is off). Runs as YOU, only while you are signed in; StartWhenAvailable runs a missed 08:00 when you next sign in.
param([switch]$Remove, [string]$At = '08:00')

$name = 'CHOSN morning health report'
if ($Remove) { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "Removed '$name'."; exit 0 }

$root = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction Stop).Source
$pythonw = Join-Path (Split-Path -Parent $python) 'pythonw.exe'
if (-not (Test-Path $pythonw)) { $pythonw = $python }

$action = New-ScheduledTaskAction -Execute $pythonw -Argument "scripts\nightly_health.py --strict" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'CHOSN: morning health report and price-history coverage check (scripts\nightly_health.py --strict). Read-only.' -Force | Out-Null

Write-Host "Registered '$name' (daily at $At)."
Write-Host "Report: $root\office\nightly\health\<date>.md"
Write-Host "Run one now:  Start-ScheduledTask -TaskName '$name'"
