@echo off
echo Starting Vibe Engine...
echo.
echo Backend: http://localhost:8765
echo.
start "Vibe Engine Backend" cmd /c "python -m uvicorn app.main:app --host 0.0.0.0 --port 8765"
echo Backend started. Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:8765
