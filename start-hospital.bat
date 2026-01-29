@echo off
title Hospital Management System

echo ==========================================
echo   Hospital Management System
echo   Starting Backend and Frontend...
echo ==========================================
echo.

:: Start Backend Server
echo [1/2] Starting Backend Server (MS Access)...
cd /d "%~dp0backend"
start "Backend Server" cmd /k "npm start"

:: Wait for backend to start
timeout /t 3 /nobreak > nul

:: Start Frontend
echo [2/2] Starting Frontend...
cd /d "%~dp0"
start "Frontend" cmd /k "npm run dev"

:: Wait and open browser
timeout /t 5 /nobreak > nul
echo.
echo ==========================================
echo   Opening browser...
echo   Backend: http://localhost:3001
echo   Frontend: http://localhost:8080
echo ==========================================
start http://localhost:8080

echo.
echo Press any key to close this window...
pause > nul
