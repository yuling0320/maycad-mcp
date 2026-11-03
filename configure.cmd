@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
node.exe "scripts\configure.mjs"
if errorlevel 1 (
  echo Setup failed. Please read the error above.
  pause
  exit /b 1
)
echo Ready. See INSTALL-zh-CN.md for connecting your MCP client.
pause

