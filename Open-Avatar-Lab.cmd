@echo off
setlocal DisableDelayedExpansion
title Al-Amr Avatar Lab - build latest and open
echo Building the current local avatar and opening its test environment...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-avatar-lab.ps1" %*
if errorlevel 1 (
  echo.
  echo Could not complete startup. Details: .local\avatar-lab-launcher\latest.log
  pause
  exit /b 1
)
endlocal
