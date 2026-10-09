# Phase2 readback fix - deploy vocab-server/server.js and restart service
# Usage:
#   cd D:\cursor\work\super-agent
#   powershell -ExecutionPolicy Bypass -File .\scratch\deploy-memory-phase2-readback.ps1

$ErrorActionPreference = 'Stop'

$serverIP = '150.158.34.217'
$serverUser = 'ubuntu'
$localFile = (Join-Path $PSScriptRoot '..\vocab-server\server.js' | Resolve-Path).Path
$remoteTarget = "${serverUser}@${serverIP}:/var/www/super-agent/vocab-server/server.js"
$serviceName = 'super-agent-vocab.service'

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Phase2 readback - deploy server.js' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Local : $localFile"
Write-Host "Remote: $remoteTarget"
Write-Host ''

Write-Host '[1/3] Upload server.js ...' -ForegroundColor Yellow
& scp $localFile $remoteTarget
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Upload failed' -ForegroundColor Red
    exit 1
}
Write-Host 'Upload OK' -ForegroundColor Green

Write-Host '[2/3] Restart service ...' -ForegroundColor Yellow
& ssh "${serverUser}@${serverIP}" "sudo systemctl restart $serviceName"
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Restart failed' -ForegroundColor Red
    exit 1
}
Write-Host 'Restart OK' -ForegroundColor Green

Write-Host '[3/3] Smoke check (pack-for-llm) ...' -ForegroundColor Yellow
Start-Sleep -Seconds 2
try {
    $smoke = Invoke-RestMethod -Uri 'https://app.liujingzhuwo.site/api/user/memory/pack-for-llm?userId=healthcheck&query=ping&format=json' -TimeoutSec 15
    $ok = [bool]$smoke.success
    Write-Host ("smoke: success=$ok pack_len=$($smoke.data.text.Length)") -ForegroundColor Green
} catch {
    Write-Host 'Smoke check failed (upload/restart may still be OK). Run verify script next.' -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Deploy done. Run verify script next:' -ForegroundColor Green
Write-Host '  powershell -ExecutionPolicy Bypass -File .\scratch\verify-memory-phase2-readback.ps1' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
