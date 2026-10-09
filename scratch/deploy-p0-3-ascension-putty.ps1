# P0-3 升维异常可见 — PuTTY 增量部署脚本（仅前端）
# 用法（PowerShell）：
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scratch\deploy-p0-3-ascension-putty.ps1" -SSHPassword '你的密码'
# 或先设置：$env:DEPLOY_SSH_PW = '你的密码'

param(
    [string]$SSHPassword = $env:DEPLOY_SSH_PW
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

if (-not $SSHPassword) {
    $sec = Read-Host 'Enter SSH password' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $SSHPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

function Invoke-Remote([string]$Command) {
    & $Plink -hostkey $HostKey -pw $SSHPassword -batch $ServerHost $Command
    if ($LASTEXITCODE -ne 0) { throw "plink failed: $Command" }
}
function Send-Remote([string]$Source, [string]$Destination) {
    & $Pscp -r -hostkey $HostKey -pw $SSHPassword -batch $Source "${ServerHost}:$Destination"
    if ($LASTEXITCODE -ne 0) { throw "pscp failed: $Source" }
}

Set-Location $ProjectRoot
Write-Host '== pnpm build ==' -ForegroundColor Cyan
pnpm install
pnpm build

Write-Host '== upload dist (pscp) ==' -ForegroundColor Cyan
Invoke-Remote "mkdir -p $RemoteWebRoot/dist/images/backgrounds $RemoteWebRoot/dist/assets"
Send-Remote "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
if (Test-Path "$ProjectRoot\dist\assets") { Send-Remote "$ProjectRoot\dist\assets" "$RemoteWebRoot/dist/" }
if (Test-Path "$ProjectRoot\dist\images") { Send-Remote "$ProjectRoot\dist\images" "$RemoteWebRoot/dist/" }

Write-Host '== nginx reload (plink) ==' -ForegroundColor Cyan
Invoke-Remote 'sudo nginx -t && sudo systemctl reload nginx'

Write-Host '== logs ==' -ForegroundColor Cyan
Invoke-Remote 'sudo journalctl -u super-agent-vocab.service -n 20 --no-pager'
Invoke-Remote 'sudo tail -n 20 /var/log/nginx/error.log'

Write-Host 'Done. https://app.liujingzhuwo.site/  (Ctrl+Shift+R)' -ForegroundColor Green
