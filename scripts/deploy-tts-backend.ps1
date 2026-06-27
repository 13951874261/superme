# 仅部署 TTS 相关后端 server.js（不依赖 git 变更检测）
$ErrorActionPreference = 'Stop'
$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$LocalServerJs = Join-Path $ProjectRoot 'vocab-server\server.js'

if (-not (Test-Path $LocalServerJs)) {
    throw "找不到 $LocalServerJs"
}

Write-Host "上传 server.js -> ${ServerHost}:${RemoteApiRoot}/server.js" -ForegroundColor Cyan
scp $LocalServerJs "${ServerHost}:${RemoteApiRoot}/server.js"

Write-Host "重启 super-agent-vocab.service ..." -ForegroundColor Cyan
ssh $ServerHost "sudo systemctl restart super-agent-vocab.service && sleep 2 && sudo systemctl is-active super-agent-vocab.service"

Write-Host "本机验证 TTS ..." -ForegroundColor Cyan
curl.exe -s -X POST "https://app.liujingzhuwo.site/api/tts/speech" -H "Content-Type: application/json" -d "{\"input\":\"Hello test\",\"model\":\"edge-tts/en-ZA-LukeNeural\"}"

Write-Host ""
Write-Host "完成。若仍失败，请检查服务器 journalctl -u super-agent-vocab.service -n 30" -ForegroundColor Green
