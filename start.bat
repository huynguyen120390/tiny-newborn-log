@echo off
setlocal
set PORT=%PORT%
if "%PORT%"=="" set PORT=3000
echo Starting Phuong Nam Logbook on http://localhost:%PORT%
node backend\server.js %PORT%
