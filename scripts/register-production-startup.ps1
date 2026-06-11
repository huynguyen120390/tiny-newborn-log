param(
  [int]$ProdPort = 3002,
  [int]$OpsPort = 3010
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ProdScript = Join-Path $Root "scripts\start-production-server.ps1"
$OpsScript = Join-Path $Root "scripts\start-server-control.ps1"

if (!(Test-Path $ProdScript)) {
  throw "Missing startup script: $ProdScript"
}

if (!(Test-Path $OpsScript)) {
  throw "Missing startup script: $OpsScript"
}

$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

function Register-HiddenServerTask {
  param(
    [string]$TaskName,
    [string]$ScriptPath,
    [int]$Port,
    [string]$Description
  )

  $ActionArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`" -Port $Port"
  $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $ActionArgs -WorkingDirectory $Root
  $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
  $Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -MultipleInstances IgnoreNew
  $Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Limited

  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description $Description `
    -Force | Out-Null

  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Registered and started scheduled task: $TaskName"
}

Register-HiddenServerTask `
  -TaskName "TinyNewbornLog Production Server" `
  -ScriptPath $ProdScript `
  -Port $ProdPort `
  -Description "Starts TinyNewbornLog production server on http://localhost:$ProdPort after Windows logon."

Register-HiddenServerTask `
  -TaskName "TinyNewbornLog Server Control" `
  -ScriptPath $OpsScript `
  -Port $OpsPort `
  -Description "Starts TinyNewbornLog Server Control on http://localhost:$OpsPort after Windows logon."

Write-Host "Production URL: http://localhost:$ProdPort"
Write-Host "Server Control URL: http://localhost:$OpsPort"
