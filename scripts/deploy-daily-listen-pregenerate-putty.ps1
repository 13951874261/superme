# Full-stack deploy (frontend + backend) for Daily Listen Pregenerate round.
# PuTTY pscp/plink only. ASCII-safe for Windows PowerShell 5.1.
#
# Round changes:
#   Backend: server.js, dailyPackCron.js, dailyListenPreGenerateService.js (new tables + APIs + cron)
#   Frontend: ListenTab, TaskCenter, listenPregeneratedAPI, login-ping
#
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-daily-listen-pregenerate-putty.ps1"
#
# Or one-liner via deploy-smart (includes git commit/push if configured):
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-smart.ps1"

param(
    [string]$SSHPassword = ''
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

$BackendFiles = @(
    'server.js',
    'services/dailyPackCron.js',
    'services/dailyListenPreGenerateService.js'
)

Set-Location $ProjectRoot

Write-Host '========== Change set (daily listen pregenerate) ==========' -ForegroundColor Cyan
Write-Host ' Backend:' ($BackendFiles -join ', ')
Write-Host ' Frontend: pnpm build + dist upload'
Write-Host ' Remote dirs: public/daily_listen_audio, public/daily_long_articles (mkdir only)'
Write-Host ' NOT uploaded: vocab.db, local smoke mp3/txt under public/'
Write-Host ''

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

function Send-RemoteRecurse {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    $target = $ServerHost + ':' + $Destination
    & $Pscp -r -hostkey $HostKey -pw $SSHPassword -batch $Source $target
    if ($LASTEXITCODE -ne 0) {
        throw ("pscp -r failed: " + $Source + ' -> ' + $Destination)
    }
}

Write-Host '========== local syntax check (backend) ==========' -ForegroundColor Cyan
foreach ($rel in $BackendFiles) {
    $local = Join-Path $ProjectRoot ('vocab-server\' + ($rel -replace '/', '\'))
    if (-not (Test-Path $local -PathType Leaf)) {
        throw "Local file not found: $local"
    }
    node --check $local
    if ($LASTEXITCODE -ne 0) { throw ("node --check failed: " + $rel) }
}

Write-Host '========== pnpm install / build (frontend) ==========' -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

Write-Host '========== remote backup + mkdir ==========' -ForegroundColor Cyan
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Invoke-Remote -RemoteCommand ("cp " + $RemoteApiRoot + "/server.js " + $RemoteApiRoot + "/server.js.bak-" + $timestamp + " 2>/dev/null || true")
Invoke-Remote -RemoteCommand ("mkdir -p " + $RemoteApiRoot + "/services " + $RemoteApiRoot + "/public/daily_listen_audio " + $RemoteApiRoot + "/public/daily_long_articles " + $RemoteWebRoot + "/dist/images/backgrounds " + $RemoteWebRoot + "/dist/assets")

Write-Host '========== upload backend ==========' -ForegroundColor Cyan
foreach ($rel in $BackendFiles) {
    $local = Join-Path $ProjectRoot ('vocab-server\' + ($rel -replace '/', '\'))
    Send-Remote -Source $local -Destination ($RemoteApiRoot + '/' + $rel)
}

Write-Host '========== upload dist (frontend) ==========' -ForegroundColor Cyan
Send-Remote -Source ($ProjectRoot + '\dist\index.html') -Destination ($RemoteWebRoot + '/dist/')
if (Test-Path ($ProjectRoot + '\dist\assets')) {
    Send-RemoteRecurse -Source ($ProjectRoot + '\dist\assets') -Destination ($RemoteWebRoot + '/dist/')
}
if (Test-Path ($ProjectRoot + '\dist\images')) {
    Send-RemoteRecurse -Source ($ProjectRoot + '\dist\images') -Destination ($RemoteWebRoot + '/dist/')
}

Write-Host '========== remote syntax check ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand ("node --check " + $RemoteApiRoot + "/server.js")
Invoke-Remote -RemoteCommand ("node --check " + $RemoteApiRoot + "/services/dailyListenPreGenerateService.js")

Write-Host '========== restart + verify ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo systemctl restart super-agent-vocab.service'
Start-Sleep -Seconds 3
Invoke-Remote -RemoteCommand 'sudo systemctl is-active super-agent-vocab.service'
Invoke-Remote -RemoteCommand 'curl -s http://127.0.0.1:3001/api/vocab/health'
Invoke-Remote -RemoteCommand 'curl -s "http://127.0.0.1:3001/api/listen/pregenerated?userId=deploy-smoke&theme=smoke&genre=meeting&cefrLevel=B1&duration=15" | head -c 400'
Invoke-Remote -RemoteCommand 'sudo nginx -t ; sudo systemctl reload nginx'

Write-Host ''
Write-Host 'Done. Hard-refresh https://ai.234124123.xyz/ then test English -> Listen tab.' -ForegroundColor Green
Write-Host 'Check: missing combo shows backfill banner; Task Center shows listen_backfill.' -ForegroundColor DarkCyan
Write-Host 'This script does not git commit/push. See scripts/deploy-daily-listen-pregenerate-putty.ps1 header or README block in chat.' -ForegroundColor DarkGray
