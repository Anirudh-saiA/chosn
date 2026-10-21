# Registers the news cycle as a Windows Task Scheduler job, separate from the nightly price update:
#   CHOSN news every 30 minutes    runs scripts\news_update.py: news feeds, official news, newsletters, tags, pictures
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-news-task.ps1            # register (or update)
#   powershell -ExecutionPolicy Bypass -File scripts\register-news-task.ps1 -Remove    # unregister
#
# Runs as YOU, only while you are logged in, like the daily job. A cycle takes about 2 to 4 minutes; one that would start while the last is
# still running is skipped (MultipleInstances IgnoreNew, plus a lock file in news_update.py). pythonw runs it without a console window.
# Docker Desktop must be running (the cycle skips itself and says so in logs\news-<date>.log when it is not).
param([switch]$Remove, [int]$EveryMinutes = 10)

$name = 'CHOSN news cycle'
$old = 'CHOSN news every 30 minutes'   # the first name of this task
Unregister-ScheduledTask -TaskName $old -Confirm:$false -ErrorAction SilentlyContinue
if ($Remove) { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "Removed '$name'."; exit 0 }

$root = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction Stop).Source
$pythonw = Join-Path (Split-Path -Parent $python) 'pythonw.exe'
if (-not (Test-Path $pythonw)) { $pythonw = $python }

$action = New-ScheduledTaskAction -Execute $pythonw -Argument "scripts\news_update.py" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'CHOSN: news feeds, official news, newsletters, tags and pictures every 30 minutes (scripts\news_update.py).' -Force | Out-Null

Write-Host "Registered '$name' (every $EveryMinutes minutes, first run in 2 minutes)."
Write-Host "Logs: $root\logs\news-<date>.log    Last cycle: $root\data\daily\news_last_run.json"
Write-Host "Run one now:  Start-ScheduledTask -TaskName '$name'"
