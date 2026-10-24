param(
    [string]$SSHPassword = '19890430@lmq'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

Set-Location $ProjectRoot

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
    & $Pscp -r -hostkey $HostKey -pw $SSHPassword -batch $Source $target
    if ($LASTEXITCODE -ne 0) {
        throw ("pscp failed: " + $Source + ' -> ' + $Destination)
    }
}

Write-Host '========== upload dist (pscp) ==========' -ForegroundColor Cyan
$mkdirCmd = 'mkdir -p ' + $RemoteWebRoot + '/dist/images/backgrounds ' + $RemoteWebRoot + '/dist/assets'
Invoke-Remote -RemoteCommand $mkdirCmd

Send-Remote -Source ($ProjectRoot + '\dist\index.html') -Destination ($RemoteWebRoot + '/dist/')
if (Test-Path ($ProjectRoot + '\dist\assets')) {
    Send-Remote -Source ($ProjectRoot + '\dist\assets') -Destination ($RemoteWebRoot + '/dist/')
}
if (Test-Path ($ProjectRoot + '\dist\images')) {
    Send-Remote -Source ($ProjectRoot + '\dist\images') -Destination ($RemoteWebRoot + '/dist/')
}

Write-Host '========== nginx reload (plink) ==========' -ForegroundColor Cyan
Invoke-Remote -RemoteCommand 'sudo nginx -t ; sudo systemctl reload nginx'

Write-Host 'Done. Open https://app.liujingzhuwo.site/ and hard-refresh (Ctrl+Shift+R).' -ForegroundColor Green