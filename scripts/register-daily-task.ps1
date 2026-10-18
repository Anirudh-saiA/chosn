# Registers two Windows Task Scheduler jobs:
#   CHOSN webscraper daily update   every day at 02:00      the fast stores (Superkicks, Crepdog, Mainstreet,
#                                                           Limited Edt, Gully Labs), about 10 minutes
#   CHOSN webscraper weekly full    Sundays at 01:00        everything, including the three slow stores
#                                                           (VegNonVeg, Myntra, Puma)
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-daily-task.ps1            # register both
#   powershell -ExecutionPolicy Bypass -File scripts\register-daily-task.ps1 -Remove    # unregister both
#
# They run as YOU (no admin rights), only while you are logged in. If the PC was off at the time they run as soon as the
# PC is back (StartWhenAvailable). Docker Desktop must be running: the job starts it if it is not. A job never starts
# while the other one is still running (MultipleInstances IgnoreNew applies per task; the daily one is also skipped on
# a Sunday if the weekly one is still going, because both take the same lock in daily_update.py).
param([switch]$Remove, [string]$At = '02:00', [string]$WeeklyAt = '01:00')

$daily  = 'CHOSN webscraper daily update'
$weekly = 'CHOSN webscraper weekly full'
if ($Remove) {
  foreach ($n in @($daily, $weekly)) { Unregister-ScheduledTask -TaskName $n -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "Removed '$n'." }
  exit 0
}

$root = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction Stop).Source

function New-Wrapper($file, $args) {
  $path = Join-Path $root "scripts\$file"
@"
@echo off
cd /d "$root"
docker info >nul 2>&1 || (start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" & timeout /t 90 /nobreak >nul & docker compose up -d)
"$python" scripts\webscraper\run.py all $args
"@ | Set-Content -Path $path -Encoding ASCII
  return $path
}
$dailyCmd  = New-Wrapper 'run-daily.cmd' '--quick'
$weeklyCmd = New-Wrapper 'run-weekly.cmd' ''

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 5) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $daily -Action (New-ScheduledTaskAction -Execute $dailyCmd -WorkingDirectory $root) `
  -Trigger (New-ScheduledTaskTrigger -Daily -At $At) -Settings $settings `
  -Description 'CHOSN: fast stores (Superkicks, Crepdog Crew, Mainstreet, Limited Edt, Gully Labs), pairing, import and price history.' -Force | Out-Null
Register-ScheduledTask -TaskName $weekly -Action (New-ScheduledTaskAction -Execute $weeklyCmd -WorkingDirectory $root) `
  -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $WeeklyAt) -Settings $settings `
  -Description 'CHOSN: every store including VegNonVeg, Myntra and Puma India (the slow ones), then pairing, import and price history.' -Force | Out-Null

Write-Host "Registered '$daily' (daily at $At, fast stores) and '$weekly' (Sundays at $WeeklyAt, everything)."
Write-Host "Logs: $root\logs\daily-<date>.log"
Write-Host "Run one now to test:  Start-ScheduledTask -TaskName '$daily'"
