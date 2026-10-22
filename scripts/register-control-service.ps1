# Registers a Windows Task Scheduler job that starts the CHOSN control service (scripts\webscraper\control.py) whenever you
# log in, so n8n can start and watch the nightly update. Runs as YOU, no admin rights, hidden window.
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-control-service.ps1            # register (and start it now)
#   powershell -ExecutionPolicy Bypass -File scripts\register-control-service.ps1 -Remove    # unregister
param([switch]$Remove)
$name = 'CHOSN control service'
if ($Remove) { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "Removed '$name'."; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
$python = (Get-Command pythonw -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = (Get-Command python -ErrorAction Stop).Source }
$action   = New-ScheduledTaskAction -Execute $python -Argument "scripts\webscraper\control.py" -WorkingDirectory $root
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description 'Lets n8n start and watch the CHOSN price update (127.0.0.1:8765, token required).' -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host "Registered and started '$name'. It starts at every login."
