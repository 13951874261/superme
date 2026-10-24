# Incremental deploy: Daily Pack Dify inputs fill (PuTTY pscp/plink).
# ASCII-safe for Windows PowerShell 5.1.
#
# Round changes (backend only):
#   services/dailyPackService.js — theme/history_exclude/user_current_profile/_system_*
#   server.js — regenerate wakeup/flaw pass full inputs + user theme for flaw
#
# NOT uploaded: vocab.db, frontend dist, .env, public smoke assets
#
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-daily-pack-inputs-putty.ps1"
#
# Or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-daily-pack-inputs-putty.ps1" -SSHPassword 'your-password'

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

$BackendFiles = @(
    'server.js',
    'services/dailyPackService.js'
)

Set-Location $ProjectRoot

Write-Host '========== Change set (daily pack Dify inputs) ==========' -ForegroundColor Cyan
Write-Host ' Backend:' ($BackendFiles -join ', ')
Write-Host ' Frontend: skip (no UI change this round)'
Write-Host ' NOT uploaded: vocab.db, dist, .env'
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

Write-Host '========== local syntax check ==========' -ForegroundColor Cyan
foreach ($rel in $BackendFiles) {
    $local = Join-Path $ProjectRoot ('vocab-server\' + ($rel -replace '/', '\'))
    if (-not (Test-Path $local -PathType Leaf)) {
        throw "Local file not found: $local"
    }
    node --check $local
    if ($LASTEXITCODE -ne 0) { throw ("node --check failed: " + $rel) }
}

Write-Host '========== remote backup ==========' -ForegroundColor Cyan
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Invoke-Remote -RemoteCommand ("mkdir -p " + $RemoteApiRoot + "/services")
Invoke-Remote -RemoteCommand ("cp " + $RemoteApiRoot + "/server.js " + $RemoteApiRoot + "/server.js.bak-" + $timestamp + " 2>/dev/null || true")
Invoke-Remote -RemoteCommand ("cp " + $RemoteApiRoot + "/services/dailyPackService.js " + $RemoteApiRoot + "/services/dailyPackService.js.bak-" + $timestamp + " 2>/dev/null || true")

Write-Host '========== upload backend ==========' -ForegroundColor Cyan
foreach ($rel in $BackendFiles) {
    $local = Join-Path $ProjectRoot ('vocab-server\' + ($rel -replace '/', '\'))
    Send-Remote -Source $local -Destination ($RemoteApiRoot + '/' + $rel)
}

Write-Host '========== remote syntax check ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand ("node --check " + $RemoteApiRoot + "/server.js")
Invoke-Remote -RemoteCommand ("node --check " + $RemoteApiRoot + "/services/dailyPackService.js")

Write-Host '========== restart + verify ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo systemctl restart super-agent-vocab.service'
Start-Sleep -Seconds 3
Invoke-Remote -RemoteCommand 'sudo systemctl is-active super-agent-vocab.service'
Invoke-Remote -RemoteCommand 'sudo journalctl -u super-agent-vocab.service -n 30 --no-pager'

Write-Host ''
Write-Host 'Done. Backend-only deploy for Dify start inputs.' -ForegroundColor Green
Write-Host 'Verify: English -> Daily Wakeup -> Regenerate; or POST /api/daily-pack/regenerate type=wakeup' -ForegroundColor DarkCyan
Write-Host 'Expect Dify inputs: theme, history_exclude, user_current_profile, _system_time, _system_timestamp_ms' -ForegroundColor DarkCyan
Write-Host 'This script does not git commit/push.' -ForegroundColor DarkGray
