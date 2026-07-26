# Frontend-only deploy: DailyWakeup load/timeout fix (PuTTY).
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-daily-wakeup-loadfix-putty.ps1"

param([string]$SSHPassword = '')

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

Set-Location $ProjectRoot

if (-not $SSHPassword) { $SSHPassword = $env:DEPLOY_SSH_PW }
if (-not $SSHPassword) {
    $sec = Read-Host 'Enter SSH password' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $SSHPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

function Invoke-Remote([string]$RemoteCommand) {
    & $Plink -hostkey $HostKey -pw $SSHPassword -batch $ServerHost $RemoteCommand
    if ($LASTEXITCODE -ne 0) { throw "plink failed: $RemoteCommand" }
}
function Send-Remote([string]$Source, [string]$Destination) {
    & $Pscp -hostkey $HostKey -pw $SSHPassword -batch $Source ($ServerHost + ':' + $Destination)
    if ($LASTEXITCODE -ne 0) { throw "pscp failed: $Source" }
}
function Send-RemoteRecurse([string]$Source, [string]$Destination) {
    & $Pscp -r -hostkey $HostKey -pw $SSHPassword -batch $Source ($ServerHost + ':' + $Destination)
    if ($LASTEXITCODE -ne 0) { throw "pscp -r failed: $Source" }
}

Write-Host '========== pnpm build ==========' -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

Write-Host '========== upload dist ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand ("mkdir -p " + $RemoteWebRoot + "/dist/assets " + $RemoteWebRoot + "/dist/images")
Send-Remote -Source ($ProjectRoot + '\dist\index.html') -Destination ($RemoteWebRoot + '/dist/')
if (Test-Path ($ProjectRoot + '\dist\assets')) {
    Send-RemoteRecurse -Source ($ProjectRoot + '\dist\assets') -Destination ($RemoteWebRoot + '/dist/')
}
if (Test-Path ($ProjectRoot + '\dist\images')) {
    Send-RemoteRecurse -Source ($ProjectRoot + '\dist\images') -Destination ($RemoteWebRoot + '/dist/')
}

Write-Host '========== nginx reload ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo nginx -t ; sudo systemctl reload nginx'

Write-Host 'Done. Hard-refresh https://app.liujingzhuwo.site/ (Ctrl+Shift+R).' -ForegroundColor Green
Write-Host 'Expect: auto-load today pack OR notice shows load error / userId when missing.' -ForegroundColor DarkCyan
