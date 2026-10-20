@echo off
setlocal DisableDelayedExpansion
title Al-Amr Avatar Lab - build latest and open
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-avatar-lab.ps1" %*
if errorlevel 1 (
  echo.
  echo Could not complete startup. Details: .local\avatar-lab-launcher\latest.log
  pause
  exit /b 1
)
endlocal
