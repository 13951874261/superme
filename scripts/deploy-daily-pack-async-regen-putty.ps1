# Deploy: async regenerate + today coalescing (backend + frontend). PuTTY.
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-daily-pack-async-regen-putty.ps1"

param([string]$SSHPassword = '')

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

$BackendFiles = @('server.js')

Set-Location $ProjectRoot

if (-not $SSHPassword) { $SSHPassword = $env:DEPLOY_SSH_PW }
if (-not $SSHPassword) {
    $sec = Read-Host 'Enter SSH password' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $SSHPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

function Invoke-Remote([string]$Cmd) {
    & $Plink -hostkey $HostKey -pw $SSHPassword -batch $ServerHost $Cmd
    if ($LASTEXITCODE -ne 0) { throw "plink failed: $Cmd" }
}
function Send-Remote([string]$Source, [string]$Destination) {
    & $Pscp -hostkey $HostKey -pw $SSHPassword -batch $Source ($ServerHost + ':' + $Destination)
    if ($LASTEXITCODE -ne 0) { throw "pscp failed: $Source" }
}
function Send-RemoteRecurse([string]$Source, [string]$Destination) {
    & $Pscp -r -hostkey $HostKey -pw $SSHPassword -batch $Source ($ServerHost + ':' + $Destination)
    if ($LASTEXITCODE -ne 0) { throw "pscp -r failed: $Source" }
}

Write-Host '========== local check backend ==========' -ForegroundColor Cyan
node --check (Join-Path $ProjectRoot 'vocab-server\server.js')
if ($LASTEXITCODE -ne 0) { throw 'node --check server.js failed' }

Write-Host '========== pnpm build ==========' -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

Write-Host '========== upload backend ==========' -ForegroundColor Cyan
foreach ($rel in $BackendFiles) {
    Send-Remote -Source (Join-Path $ProjectRoot ('vocab-server\' + $rel)) -Destination ($RemoteApiRoot + '/' + $rel)
}

Write-Host '========== upload dist ==========' -ForegroundColor Cyan
Invoke-Remote "mkdir -p $RemoteWebRoot/dist/assets $RemoteWebRoot/dist/images"
Send-Remote -Source ($ProjectRoot + '\dist\index.html') -Destination ($RemoteWebRoot + '/dist/')
Send-RemoteRecurse -Source ($ProjectRoot + '\dist\assets') -Destination ($RemoteWebRoot + '/dist/')
if (Test-Path ($ProjectRoot + '\dist\images')) {
    Send-RemoteRecurse -Source ($ProjectRoot + '\dist\images') -Destination ($RemoteWebRoot + '/dist/')
}

Write-Host '========== restart ==========' -ForegroundColor Cyan
Invoke-Remote "node --check $RemoteApiRoot/server.js"
Invoke-Remote 'sudo systemctl restart super-agent-vocab.service'
Start-Sleep -Seconds 3
Invoke-Remote 'sudo systemctl is-active super-agent-vocab.service'
Invoke-Remote 'sudo nginx -t ; sudo systemctl reload nginx'

Write-Host ''
Write-Host 'Done. CLOSE all site tabs, open ONE incognito window, Ctrl+Shift+R.' -ForegroundColor Green
Write-Host 'Expect: notice loads pack quickly OR shows clear error; regenerate returns fast then polls.' -ForegroundColor DarkCyan
