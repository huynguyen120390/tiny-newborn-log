@echo off
setlocal

set PORT=%PORT%
if "%PORT%"=="" set PORT=3002

set BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
if exist "%BUNDLED_NODE%" set NODE_EXE=%BUNDLED_NODE%
if "%NODE_EXE%"=="" set NODE_EXE=node

set HIDDEN_VBS=%TEMP%\tinynewbornlog-start-hidden.vbs
> "%HIDDEN_VBS%" echo Set shell = CreateObject("WScript.Shell")
>> "%HIDDEN_VBS%" echo shell.CurrentDirectory = "%CD%"
>> "%HIDDEN_VBS%" echo shell.Run Chr(34) ^& "%NODE_EXE%" ^& Chr(34) ^& " backend\server.js %PORT%", 0, False
wscript.exe //nologo "%HIDDEN_VBS%"

echo Started Phuong Nam Logbook hidden on http://localhost:%PORT%
