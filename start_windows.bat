@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未找到 Node.js。
  echo 請先安裝 Node.js 22 或更新版：https://nodejs.org/
  pause
  exit /b 1
)
echo.
echo   =====================================================
echo       SPIN//BREAK ARENA - 戰鬥陀螺競技場
 echo   =====================================================
echo   請使用瀏覽器進入 http://localhost:3000
echo   請保持這個視窗開啟；關閉視窗即停止伺服器。
echo   其他玩家可使用主機的區域網路 IP:3000 連線。
echo.
start "" "http://localhost:3000"
node server.js
if errorlevel 1 pause
