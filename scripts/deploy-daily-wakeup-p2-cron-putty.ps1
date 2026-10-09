# Incremental deploy: Daily Wakeup P2 + DAILY_PACK_CRON_HOUR (PuTTY pscp/plink).
# ASCII-safe for Windows PowerShell 5.1.
#
# Round changes:
#   Backend: server.js (type=wakeup regenerate), services/dailyPackCron.js (DAILY_PACK_CRON_HOUR)
#   Frontend: DailyWakeupModule.tsx (start practice vs regenerate)
#   Remote env: upsert DAILY_PACK_CRON_HOUR=1 (does NOT upload full local .env)
#
# NOT uploaded: vocab.db, vocab.db-*, public/daily_listen_*, .omx/*, tmp scripts
#
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-daily-wakeup-p2-cron-putty.ps1"
#
# Or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-daily-wakeup-p2-cron-putty.ps1" -SSHPassword 'your-password'

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
$CronHour = '2'

$BackendFiles = @(
    'server.js',
    'services/dailyPackCron.js',
    'services/contentCleanupService.js',
    'scripts/run-0200-cron-now.js',
    'scripts/check-cron-health.js'
)

Set-Location $ProjectRoot

Write-Host '========== Change set (daily wakeup P2 + cron hour) ==========' -ForegroundColor Cyan
Write-Host ' Backend:' ($BackendFiles -join ', ')
Write-Host ' Frontend: pnpm build + dist upload (DailyWakeupModule)'
Write-Host (' Remote .env upsert: DAILY_PACK_CRON_HOUR=' + $CronHour)
Write-Host ' NOT uploaded: vocab.db, local daily_listen audio/txt, full .env'
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
Invoke-Remote -RemoteCommand ("cp " + $RemoteApiRoot + "/services/dailyPackCron.js " + $RemoteApiRoot + "/services/dailyPackCron.js.bak-" + $timestamp + " 2>/dev/null || true")
Invoke-Remote -RemoteCommand ("mkdir -p " + $RemoteApiRoot + "/services " + $RemoteApiRoot + "/scripts " + $RemoteWebRoot + "/dist/images/backgrounds " + $RemoteWebRoot + "/dist/assets")

Write-Host '========== upload backend ==========' -ForegroundColor Cyan
foreach ($rel in $BackendFiles) {
    $local = Join-Path $ProjectRoot ('vocab-server\' + ($rel -replace '/', '\'))
    Send-Remote -Source $local -Destination ($RemoteApiRoot + '/' + $rel)
}

Write-Host '========== upsert remote DAILY_PACK_CRON_HOUR ==========' -ForegroundColor Cyan
# Keep remote secrets; only set/replace the hour key.
$envUpsert = @"
set -e
ENVF=/var/www/super-agent/vocab-server/.env
touch "`$ENVF"
if grep -q '^DAILY_PACK_CRON_HOUR=' "`$ENVF"; then
  sed -i 's/^DAILY_PACK_CRON_HOUR=.*/DAILY_PACK_CRON_HOUR=$CronHour/' "`$ENVF"
else
  printf '\nDAILY_PACK_CRON_HOUR=$CronHour\n' >> "`$ENVF"
fi
grep '^DAILY_PACK_CRON_HOUR=' "`$ENVF" | tail -n 1
"@
Invoke-Remote -RemoteCommand $envUpsert

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
Invoke-Remote -RemoteCommand ("node --check " + $RemoteApiRoot + "/services/dailyPackCron.js")

Write-Host '========== restart + verify ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo systemctl restart super-agent-vocab.service'
Start-Sleep -Seconds 3
Invoke-Remote -RemoteCommand 'sudo systemctl is-active super-agent-vocab.service'
Invoke-Remote -RemoteCommand 'curl -s http://127.0.0.1:3001/api/vocab/health'
Invoke-Remote -RemoteCommand 'sudo journalctl -u super-agent-vocab.service -n 40 --no-pager | grep -E "DailyPack Cron|scheduled for" || true'
Invoke-Remote -RemoteCommand 'sudo nginx -t ; sudo systemctl reload nginx'

Write-Host ''
Write-Host 'Done. Hard-refresh https://ai.234124123.xyz/ then test English -> Daily Wakeup.' -ForegroundColor Green
Write-Host 'Expect journal: scheduled for 01:00 then DailyListen' -ForegroundColor DarkCyan
Write-Host 'UI: with cache -> Start Practice (no regenerate); Regenerate -> type=wakeup only.' -ForegroundColor DarkCyan
Write-Host 'This script does not git commit/push.' -ForegroundColor DarkGray
