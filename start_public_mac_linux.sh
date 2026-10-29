#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo '需要 Node.js 22+'; exit 1; }
command -v cloudflared >/dev/null 2>&1 || { echo '先依 Cloudflare 官方安裝 cloudflared: https://developers.cloudflare.com/tunnel/downloads/'; exit 1; }
node server.js &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT INT TERM
sleep 2
printf '%s\n' '從 cloudflared 輸出複製 https://...trycloudflare.com 網址，開啟後可從手機直接分享邀請。'
cloudflared tunnel --url http://127.0.0.1:3000
