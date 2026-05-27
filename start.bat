@echo off
cd /d "%~dp0backend"
title Vibe Engine

echo Vibe Engine — Starting...
echo.

:: Kill any process listening on port 8765
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":8765"') do (
    taskkill /f /pid %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Starting server on http://localhost:8765
start "Vibe Engine Backend" cmd /c "python -m uvicorn app.main:app --host 0.0.0.0 --port 8765"

timeout /t 3 /nobreak >nul
start http://localhost:8765

echo.
echo Server started. Close this window to stop.
echo.
