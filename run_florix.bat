@echo off
title Florix AI Launcher
echo ============================================================
echo           STARTING FLORIX AI STUDY SUITE
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Launching FastAPI Backend on http://localhost:8000 ...
start "Florix AI - Backend API" cmd /k "cd Backend && ..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [2/3] Launching Vite Frontend on http://localhost:5173 ...
start "Florix AI - Frontend Web" cmd /k "cd Frontend && npm run dev"

echo [3/3] Opening Florix AI in browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ============================================================
echo   Florix AI is now running!
echo   Single Admin: ganeshyandigeri2029@gmail.com
echo ============================================================
