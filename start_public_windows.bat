@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_public_windows.ps1"
if errorlevel 1 echo [ERROR] 啟動失敗，請閱讀上方錯誤訊息。
pause
