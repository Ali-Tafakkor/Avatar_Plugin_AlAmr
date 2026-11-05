@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\stop-avatar-microphone-test.ps1"
if errorlevel 1 pause
