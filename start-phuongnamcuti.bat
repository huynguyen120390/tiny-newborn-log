@echo off
setlocal
echo Starting Phuong Nam Logbook at http://phuongnamcuti:3002
set BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" backend\server.js 3002
) else (
  node backend\server.js 3002
)
