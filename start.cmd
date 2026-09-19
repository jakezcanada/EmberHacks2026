@echo off
setlocal EnableExtensions
title Chromajam
cd /d "%~dp0"

rem  Chromajam launcher for Windows cmd.
rem    start.cmd          dev mode: Vite client (5173) + API server (3001), hot reload
rem    start.cmd prod     production build served by the API server on one port (3001)

set "MODE=%~1"
if /i "%MODE%"=="prod" (set "URL=http://localhost:3001") else (set "URL=http://localhost:5173")

echo.
echo   CHROMAJAM  -  a jam partner you can see
echo   ---------------------------------------
echo.

rem --- 1. Node.js -----------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo   [x] Node.js was not found. Install Node 20 or newer from https://nodejs.org and run this again.
  goto :fail
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 20 (
  echo   [x] Node %NODE_MAJOR% is too old. Chromajam needs Node 20 or newer.
  goto :fail
)
echo   [ok] Node.js %NODE_MAJOR%

rem --- 2. Already running? ---------------------------------------------------
netstat -ano | findstr /r /c:":5173 .*LISTENING" /c:":3001 .*LISTENING" >nul
if not errorlevel 1 (
  echo   [ok] Chromajam is already running. Opening %URL%
  start "" "%URL%"
  goto :end
)

rem --- 3. Dependencies -------------------------------------------------------
if not exist "node_modules\" (
  echo   [..] Installing packages, first run only. This takes a minute.
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo   [x] npm install failed. Check your internet connection and try again.
    goto :fail
  )
)
echo   [ok] Packages installed

rem --- 4. Environment ---------------------------------------------------------
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo   [!!] Created .env from .env.example.
)
findstr /r /c:"^GEMINI_API_KEY=your_" ".env" >nul
if not errorlevel 1 (
  echo   [!!] No Gemini API key yet: songs will come from the built-in presets.
  echo        Add GEMINI_API_KEY=... to .env for live generation.
) else (
  echo   [ok] Gemini API key found in .env
)

rem --- 5. Open the browser once the page answers (runs in the background) ------
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "for ($i = 0; $i -lt 90; $i++) { try { Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process '%URL%'; break } catch { Start-Sleep -Seconds 1 } }"

rem --- 6. Run ----------------------------------------------------------------------
echo.
if /i "%MODE%"=="prod" (
  echo   [..] Building the production client...
  call npm run build
  if errorlevel 1 (
    echo   [x] Build failed.
    goto :fail
  )
  echo.
  echo   Serving at %URL%   ^(press Ctrl+C to stop^)
  echo.
  set "NODE_ENV=production"
  node server\index.js
) else (
  echo   Starting at %URL%   ^(press Ctrl+C to stop^)
  echo.
  call npm run dev
)
goto :end

:fail
echo.
pause
exit /b 1

:end
endlocal
