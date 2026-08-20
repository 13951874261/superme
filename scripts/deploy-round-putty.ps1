# Deploy script for PuTTY (pscp/plink) - PowerShell 5.1 compatible
param(
    [string]$SSHPassword = '',
    [switch]$SkipFrontendBuild = $false
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'

$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

if (-not (Test-Path $Pscp)) { $Pscp = 'pscp.exe' }
if (-not (Test-Path $Plink)) { $Plink = 'plink.exe' }

Set-Location $ProjectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Super-Agent Deploy via PuTTY " -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

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
        throw ("plink command failed: " + $RemoteCommand)
    }
}

function Copy-LocalToRemote {
    param(
        [Parameter(Mandatory = $true)][string]$LocalPath,
        [Parameter(Mandatory = $true)][string]$RemotePath
    )
    & $Pscp -hostkey $HostKey -pw $SSHPassword -batch -r $LocalPath "${ServerHost}:${RemotePath}"
    if ($LASTEXITCODE -ne 0) {
        throw ("pscp upload failed: " + $LocalPath)
    }
}

Write-Host "[1/5] Ensuring remote directories exist..." -ForegroundColor Yellow
Invoke-Remote "mkdir -p ${RemoteApiRoot}/services ${RemoteApiRoot}/scripts"

Write-Host "[2/5] Uploading backend modified files via PuTTY (pscp)..." -ForegroundColor Yellow
$backendFiles = @(
    'vocab-server\.env',
    'vocab-server\server.js',
    'vocab-server\services\dailyPackService.js',
    'vocab-server\services\dailyPackCron.js',
    'vocab-server\services\dailyListenPreGenerateService.js',
    'vocab-server\services\cleanupService.js',
    'vocab-server\scripts\test-refactor-verification.js',
    'vocab-server\scripts\check-200-cron-readiness.js',
    'vocab-server\scripts\query-user.js',
    'vocab-server\scripts\migrate-db.js',
    'vocab-server\scripts\trigger-user-cron.js'
)

foreach ($file in $backendFiles) {
    $relativePath = $file -replace '^vocab-server\\', '' -replace '\\', '/'
    $targetRemote = "${RemoteApiRoot}/${relativePath}"
    Write-Host "  -> Uploading $file..." -NoNewline
    Copy-LocalToRemote -LocalPath "$ProjectRoot\$file" -RemotePath $targetRemote
    Write-Host " [OK]" -ForegroundColor Green
}

if (-not $SkipFrontendBuild) {
    Write-Host "`n[3/5] Building frontend dist..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

    Write-Host "[4/5] Uploading frontend dist..." -ForegroundColor Yellow
    Copy-LocalToRemote -LocalPath "$ProjectRoot\dist\*" -RemotePath "${RemoteWebRoot}/dist/"
    Write-Host "  -> Frontend dist uploaded successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[3/5 and 4/5] Skipping frontend build (SkipFrontendBuild)" -ForegroundColor Gray
}

Write-Host "`n[5/5] Running remote Node.js verification and restarting service..." -ForegroundColor Yellow
Invoke-Remote "cd ${RemoteApiRoot}; node --check server.js; node --check services/dailyPackService.js; node scripts/test-refactor-verification.js"
Invoke-Remote "sudo systemctl restart super-agent-vocab.service"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host " Deployment Completed Successfully! " -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
