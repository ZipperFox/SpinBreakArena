#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
 echo '請先安裝 Node.js 22 或更新版：https://nodejs.org/'
 exit 1
fi
printf '%s\n' '遊戲網址：http://localhost:3000 （Ctrl+C 停止）'
node server.js
