# Backend-only deploy via PuTTY (pscp/plink). ASCII-safe for Windows PowerShell 5.1.
# Round: Purification Task Center garbled log fix (restore Chinese in vocab-server/server.js)
#
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-task-center-encoding-putty.ps1"
# Or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-task-center-encoding-putty.ps1" -SSHPassword 'your-password'
#
# Equivalent deploy-smart one-liner (also git commit/push):
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-smart.ps1" -BackendOnly

param(
    [string]$SSHPassword = ''
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

Set-Location $ProjectRoot

Write-Host '========== Change set (this round) ==========' -ForegroundColor Cyan
Write-Host ' M vocab-server/server.js  (142 lines: restore corrupted ???? Chinese strings)'
Write-Host ''
Write-Host 'Fix scope:'
Write-Host '  - TTS async task logs: chunk progress, retry, completion'
Write-Host '  - image-gen / video task names and error messages'
Write-Host '  - Custom Theme, Write Review, STT, API error strings'
Write-Host ''
Write-Host 'Backend only: pscp server.js + systemctl restart super-agent-vocab'
Write-Host 'No frontend build, no nginx config, no npm install (server.js only).'
Write-Host 'Existing tasks.json history garbled logs are NOT migrated.'
Write-Host ''

$LocalServerJs = Join-Path $ProjectRoot 'vocab-server\server.js'
if (-not (Test-Path $LocalServerJs -PathType Leaf)) {
    throw "Local file not found: $LocalServerJs"
}

if (-not (Test-Path $Pscp)) { throw "pscp not found: $Pscp" }
if (-not (Test-Path $Plink)) { throw "plink not found: $Plink" }

if (-not $SSHPassword) {
    $SSHPassword = $env:DEPLOY_SSH_PW
}
if (-not $SSHPassword) {
    $sec = Read-Host 'Enter SSH password' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $SSHPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

function Invoke-Remote {
    param([Parameter(Mandatory = $true)][string]$RemoteCommand)
    & $Plink -hostkey $HostKey -pw $SSHPassword -batch $ServerHost $RemoteCommand
    if ($LASTEXITCODE -ne 0) {
        throw ("plink failed: " + $RemoteCommand)
    }
}

function Send-Remote {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    $target = $ServerHost + ':' + $Destination
    & $Pscp -hostkey $HostKey -pw $SSHPassword -batch $Source $target
    if ($LASTEXITCODE -ne 0) {
        throw ("pscp failed: " + $Source + ' -> ' + $Destination)
    }
}

Write-Host '========== local syntax check ==========' -ForegroundColor Cyan
node --check $LocalServerJs
if ($LASTEXITCODE -ne 0) { throw 'node --check vocab-server/server.js failed' }

Write-Host '========== remote backup (plink) ==========' -ForegroundColor Cyan
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupCmd = 'cp ' + $RemoteApiRoot + '/server.js ' + $RemoteApiRoot + '/server.js.bak-' + $timestamp
Invoke-Remote -RemoteCommand $backupCmd
Write-Host ('Remote backup: server.js.bak-' + $timestamp) -ForegroundColor DarkGray

Write-Host '========== upload server.js (pscp) ==========' -ForegroundColor Cyan
Send-Remote -Source $LocalServerJs -Destination ($RemoteApiRoot + '/server.js')

Write-Host '========== restart vocab service (plink) ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo systemctl restart super-agent-vocab.service'

Write-Host '========== verify (plink) ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo systemctl is-active super-agent-vocab.service'
Invoke-Remote -RemoteCommand 'curl -s http://127.0.0.1:3001/api/vocab/health'
Invoke-Remote -RemoteCommand 'curl -s http://127.0.0.1/api/vocab/health'
Invoke-Remote -RemoteCommand 'sudo journalctl -u super-agent-vocab.service -n 15 --no-pager'

Write-Host ''
Write-Host 'Done. Start a NEW TTS/listen task and open Task Center logs.' -ForegroundColor Green
Write-Host 'Expected log: [timestamp] chunk X/Y written (Chinese, not ????).' -ForegroundColor DarkCyan
Write-Host 'Old completed tasks may still show garbled history logs.' -ForegroundColor DarkGray
Write-Host 'This script does not git commit/push. Use deploy-smart.ps1 -BackendOnly for that.' -ForegroundColor DarkGray
