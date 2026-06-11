param(
  [int]$Port = 3002
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutLog = Join-Path $Root "prod-server.out.log"
$ErrLog = Join-Path $Root "prod-server.err.log"
$BundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

function Get-NodePath {
  if (Test-Path $BundledNode) {
    return $BundledNode
  }

  $Node = Get-Command node -ErrorAction SilentlyContinue
  if ($Node) {
    return $Node.Source
  }

  throw "Node.js was not found. Install Node.js or start Codex once so the bundled runtime is available."
}

function Test-PortListening {
  param([int]$LocalPort)

  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    return [bool](Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue)
  }

  $Listening = netstat -ano | Select-String -Pattern "LISTENING" | Select-String -Pattern ":$LocalPort\s"
  return [bool]$Listening
}

if (Test-PortListening -LocalPort $Port) {
  Add-Content -Path $OutLog -Value "$(Get-Date -Format s) Production server already running on port $Port."
  exit 0
}

$NodePath = Get-NodePath

Add-Content -Path $OutLog -Value "$(Get-Date -Format s) Starting production server on http://localhost:$Port"

Push-Location $Root
try {
  & $NodePath "scripts/start-mode.js" "prod" "$Port" >> $OutLog 2>> $ErrLog
} finally {
  Pop-Location
}
