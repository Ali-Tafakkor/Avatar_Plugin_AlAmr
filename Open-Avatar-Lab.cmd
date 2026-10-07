@echo off
setlocal
cd /d "%~dp0avatar-lab"
if not exist "dist\index.html" (
  echo Build output is missing. See avatar-lab\README.md.
  pause
  exit /b 1
)
call "C:\Users\alita\AppData\Roaming\al-amr\bin\alamr.cmd" dev --json
if errorlevel 1 (
  echo Could not open the preview. Keep this diagnostic output for review.
  pause
  exit /b 1
)
endlocal
