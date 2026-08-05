# 本轮：Agnes 生图接口 — 仅上传 server.js + .env 并重启后端
# 用法: powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\upload-agnes-image-gen.ps1"
# 可选: -UseSystemSSH

param([switch]$UseSystemSSH)

$ErrorActionPreference = 'Stop'
$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'

Set-Location $ProjectRoot

function Send-File($Local, $Remote) {
    if ($UseSystemSSH) {
        scp.exe $Local "${ServerHost}:$Remote"
    } else {
        $pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
        if (-not $pscp) { throw 'pscp.exe not found; use -UseSystemSSH' }
        & $pscp @('-hostkey', $HostKey) $Local "${ServerHost}:$Remote"
    }
}

function Invoke-Remote($Cmd) {
    if ($UseSystemSSH) {
        ssh.exe $ServerHost $Cmd
    } else {
        $plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
        if (-not $plink) { throw 'plink.exe not found; use -UseSystemSSH' }
        & $plink @('-hostkey', $HostKey) $ServerHost $Cmd
    }
}

Write-Host 'Backing up remote server.js ...' -ForegroundColor Cyan
Invoke-Remote "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak.`$(date +%Y%m%d%H%M%S) || true"

Write-Host 'Uploading vocab-server/server.js ...' -ForegroundColor Cyan
Send-File "$ProjectRoot\vocab-server\server.js" "$RemoteApiRoot/server.js"

Write-Host 'Uploading vocab-server/.env ...' -ForegroundColor Cyan
Send-File "$ProjectRoot\vocab-server\.env" "$RemoteApiRoot/.env"

Write-Host 'Restarting super-agent-vocab ...' -ForegroundColor Cyan
Invoke-Remote 'sudo systemctl restart super-agent-vocab.service && sudo systemctl is-active super-agent-vocab.service'

Write-Host 'Done. Verify: 生词本 -> 图片记忆 -> 重新生成 AI 记忆' -ForegroundColor Green
