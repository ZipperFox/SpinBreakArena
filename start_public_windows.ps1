$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ' SPIN//BREAK ARENA V2 - 手機遠端連線啟動' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '找不到 Node.js，請先安裝 Node.js 22+：https://nodejs.org/' }
$cloud = Join-Path $PSScriptRoot 'tools\cloudflared.exe'
if (-not (Test-Path -LiteralPath $cloud)) {
  $found = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($found) { $cloud = $found.Source }
  else {
    Write-Host '首次使用需要 Cloudflare 官方 cloudflared 程式（不需要帳號）。' -ForegroundColor Yellow
    Write-Host '下載來源：https://github.com/cloudflare/cloudflared/releases'
    $answer = Read-Host '是否從 Cloudflare 官方 GitHub 下載 Windows x64 版？(Y/N)'
    if ($answer -notin @('Y','y')) { Write-Host '已取消下載。'; exit 1 }
    $dir = Join-Path $PSScriptRoot 'tools'
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $release = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    Write-Host '正在下載 cloudflared…'
    $ProgressPreference = 'SilentlyContinue'
    try {
      Invoke-WebRequest -Uri $release -OutFile $cloud -UseBasicParsing
      if ((Get-Item -LiteralPath $cloud).Length -lt 1000000) { throw '檔案大小不合理' }
    } catch { Remove-Item $cloud -ErrorAction SilentlyContinue; throw ('官方下載失敗：' + $_.Exception.Message) }
  }
}
$ownedNode = $null
$tunnelProc = $null
try {
  $running = $false
  try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 2; $running = ($health.ok -eq $true -and $health.game -eq 'spin-break-arena') } catch {}
  if (-not $running) {
    $ownedNode = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.js' -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Minimized
    Start-Sleep -Seconds 2
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 5
    if ($health.game -ne 'spin-break-arena') { throw '3000 埠已被其他程式占用或伺服器啟動失敗' }
  }
  Write-Host '遊戲伺服器已就緒，正在建立 HTTPS 臨時邀請網址…' -ForegroundColor Green
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $cloud
  $psi.Arguments = 'tunnel --url http://127.0.0.1:3000'
  $psi.UseShellExecute = $false
  $psi.RedirectStandardError = $true
  $psi.RedirectStandardOutput = $true
  $psi.CreateNoWindow = $true
  $tunnelProc = New-Object System.Diagnostics.Process
  $tunnelProc.StartInfo = $psi
  [void]$tunnelProc.Start()
  $printed = $false
  while (-not $tunnelProc.StandardError.EndOfStream) {
    $line = $tunnelProc.StandardError.ReadLine()
    if (-not $line) { continue }
    if (-not $printed -and $line -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
      $url = $Matches[0]
      $printed = $true
      Write-Host '============================================' -ForegroundColor Green
      Write-Host '公開遊戲網址：' -ForegroundColor Green
      Write-Host $url -ForegroundColor Yellow
      Write-Host '已複製網址到剪貼簿（貼給手機或朋友即可）。' -ForegroundColor Cyan
      Write-Host '請保持此視窗開啟，關閉後臨時網址即失效。' -ForegroundColor Yellow
      Write-Host '============================================'
      try { Set-Clipboard -Value $url } catch {}
      Start-Process $url
    } elseif ($line -match '(error|fail)' -and -not $printed) { Write-Host $line -ForegroundColor DarkYellow }
  }
  if (-not $printed) { throw '未取得臨時網址，請檢查網路連線或 Cloudflare 服務。' }
} finally {
  if ($tunnelProc -and -not $tunnelProc.HasExited) { $tunnelProc.Kill() }
  if ($ownedNode -and -not $ownedNode.HasExited) { Stop-Process -Id $ownedNode.Id -ErrorAction SilentlyContinue }
}
