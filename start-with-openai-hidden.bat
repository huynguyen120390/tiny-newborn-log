@echo off
setlocal

rem Fill OPENAI_API_KEY in start-with-openai.bat first.
rem This script starts the server hidden with those OpenAI settings.

if not exist "%CD%\start-with-openai.bat" (
  echo Missing start-with-openai.bat. Copy start-with-openai.example.bat first.
  pause
  exit /b 1
)

call "%CD%\start-with-openai.bat" --hidden
