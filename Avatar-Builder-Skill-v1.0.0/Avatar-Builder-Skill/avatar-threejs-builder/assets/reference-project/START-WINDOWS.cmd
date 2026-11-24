@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not on PATH.
  echo Install Node.js 22 or newer, then run this file again.
  pause
  exit /b 1
)
node start.mjs
if errorlevel 1 pause
