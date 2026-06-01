@echo off
setlocal
set PORT=%PORT%
if "%PORT%"=="" set PORT=3002
echo Starting Phuong Nam Logbook on http://localhost:%PORT%
set BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" backend\server.js %PORT%
) else (
  node backend\server.js %PORT%
)
