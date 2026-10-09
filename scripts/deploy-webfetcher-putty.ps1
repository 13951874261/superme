# Upload fixed webFetcher.js via PuTTY (pscp/plink). ASCII-safe for Windows PowerShell 5.1.
#
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-webfetcher-putty.ps1"

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

$LocalFile = Join-Path $ProjectRoot 'vocab-server\services\webFetcher.js'
if (-not (Test-Path $LocalFile -PathType Leaf)) {
    throw "Local file not found: $LocalFile"
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
node --check $LocalFile
if ($LASTEXITCODE -ne 0) { throw 'node --check webFetcher.js failed' }

Write-Host '========== remote backup ==========' -ForegroundColor Cyan
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Invoke-Remote -RemoteCommand ("mkdir -p " + $RemoteApiRoot + "/services && cp " + $RemoteApiRoot + "/services/webFetcher.js " + $RemoteApiRoot + "/services/webFetcher.js.bak-" + $timestamp + " 2>/dev/null || true")

Write-Host '========== upload webFetcher.js ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand ("mkdir -p " + $RemoteApiRoot + "/services")
Send-Remote -Source $LocalFile -Destination ($RemoteApiRoot + '/services/webFetcher.js')

Write-Host '========== remote syntax check ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand ("node --check " + $RemoteApiRoot + "/services/webFetcher.js")

Write-Host '========== restart + verify ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo systemctl restart super-agent-vocab.service'
Start-Sleep -Seconds 2
Invoke-Remote -RemoteCommand 'sudo systemctl is-active super-agent-vocab.service'
# Avoid PowerShell eating JSON quotes: write body on remote, then curl -d @file
Invoke-Remote -RemoteCommand 'echo ''{"url":"https://example.com"}'' > /tmp/fetch-url-body.json'
Invoke-Remote -RemoteCommand 'curl -s -X POST http://127.0.0.1:3001/api/materials/fetch-url -H Content-Type:application/json -d @/tmp/fetch-url-body.json'

Write-Host ''
Write-Host 'Done. Refresh the page and retry webpage preview.' -ForegroundColor Green
