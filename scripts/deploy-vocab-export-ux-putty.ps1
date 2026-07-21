# Frontend-only deploy via PuTTY (pscp/plink). ASCII-safe for Windows PowerShell 5.1.
# Round: Ebbinghaus vocab CSV export + VocabularyBook / FlashCard / VocabTab UI
#
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-vocab-export-ux-putty.ps1"
# Or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-vocab-export-ux-putty.ps1" -SSHPassword 'your-password'
#
# One-liner (same as deploy-smart frontend path, PuTTY mode):
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-smart.ps1" -FrontendOnly

param(
    [string]$SSHPassword = ''
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

Set-Location $ProjectRoot

Write-Host '========== Change set (this round) ==========' -ForegroundColor Cyan
Write-Host ' M src/components/VocabularyBook.tsx'
Write-Host ' M src/components/FlashCard.tsx'
Write-Host ' M src/components/modules/english/tabs/VocabTab.tsx'
Write-Host '?? src/components/VocabExportControl.tsx'
Write-Host '?? src/utils/vocabCsvExport.ts'
Write-Host '?? scripts/smoke-vocab-csv.mjs  (local smoke only; not uploaded)'
Write-Host 'Frontend only: pnpm build + pscp dist + plink nginx reload'
Write-Host 'No vocab-server / nginx site config changes this round.'
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
    & $Pscp -r -hostkey $HostKey -pw $SSHPassword -batch $Source $target
    if ($LASTEXITCODE -ne 0) {
        throw ("pscp failed: " + $Source + ' -> ' + $Destination)
    }
}

Write-Host '========== pnpm install / build ==========' -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

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

Write-Host ''
Write-Host 'Done. Open https://app.liujingzhuwo.site/ and hard-refresh (Ctrl+Shift+R).' -ForegroundColor Green
Write-Host 'Check: sidebar VocabularyBook export + VocabTab export; flashcard phonetic.' -ForegroundColor DarkCyan
Write-Host 'This script does not git commit/push. Use deploy-smart.ps1 -FrontendOnly for that.' -ForegroundColor DarkGray
