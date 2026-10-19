@echo off
setlocal
cd /d "%~dp0avatar-lab"
if not exist "dist\index.html" (
  echo Build output is missing. See avatar-lab\README.md.
  pause
  exit /b 1
)
if not exist "%APPDATA%\al-amr\bin\alamr.cmd" (
  echo Al-Amr Desktop CLI is not installed for this Windows account.
  pause
  exit /b 1
)
call "%APPDATA%\al-amr\bin\alamr.cmd" dev --json
if errorlevel 1 (
  echo Could not open the preview. Keep this diagnostic output for review.
  pause
  exit /b 1
)
endlocal
