@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Please install Node.js 22 or newer. & pause & exit /b 1)
if not exist node_modules\three\build\three.module.js call npm install --omit=dev
if errorlevel 1 (echo Dependency installation failed. & pause & exit /b 1)
start "" http://127.0.0.1:5177
node server.mjs
pause
