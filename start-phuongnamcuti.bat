@echo off
setlocal
echo Starting Phuong Nam Logbook at http://phuongnamcuti
set BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" backend\server.js 80
) else (
  node backend\server.js 80
)
