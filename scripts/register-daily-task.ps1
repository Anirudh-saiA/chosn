# Registers a Windows Task Scheduler job that runs the CHOSN daily update at 2:00 AM.
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-daily-task.ps1            # register
#   powershell -ExecutionPolicy Bypass -File scripts\register-daily-task.ps1 -Remove    # unregister
#
# It runs as YOU (no admin rights), only while you are logged in. If the PC was off at 2:00 AM it runs as soon as
# the PC is back (StartWhenAvailable). Docker Desktop must be running: the job starts it if it is not.
param([switch]$Remove, [string]$At = '02:00')

$name = 'CHOSN daily update'
if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed '$name'."
  exit 0
}

$root = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction Stop).Source
$wrapper = Join-Path $root 'scripts\run-daily.cmd'

# A tiny wrapper so Docker is up before the job starts.
@"
@echo off
cd /d "$root"
docker info >nul 2>&1 || (start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" & timeout /t 90 /nobreak >nul & docker compose up -d)
"$python" scripts\daily_update.py
"@ | Set-Content -Path $wrapper -Encoding ASCII

$action   = New-ScheduledTaskAction -Execute $wrapper -WorkingDirectory $root
$trigger  = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description 'Scrapes Superkicks, Crepdog Crew and VegNonVeg, imports prices and records history.' -Force | Out-Null
Write-Host "Registered '$name' to run daily at $At. Logs: $root\logs\daily-<date>.log"
Write-Host "Run it now to test:  Start-ScheduledTask -TaskName '$name'"
