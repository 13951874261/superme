# One-shot: upload server bash script + run on remote (PuTTY pscp/plink).
# ASCII-safe for Windows PowerShell 5.1.
#
# Default: run daily-pack cron + regenerate wakeup for sample user.
#
# Usage:
#   $env:DEPLOY_SSH_PW = 'your-password'
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\run-manual-daily-pack-cron-putty.ps1"
#
#   # cron only
#   ... -File "...\run-manual-daily-pack-cron-putty.ps1" -CronOnly
#
#   # only one user (skip cron)
#   ... -File "...\run-manual-daily-pack-cron-putty.ps1" -SkipCron -UserId 'user_xxx' -Theme '主题'

param(
    [string]$SSHPassword = '',
    [switch]$CronOnly,
    [switch]$SkipCron,
    [switch]$ListenToo,
    [string]$UserId = 'user_6f33882d-3363-4e8b-877b-f4c5ace73176',
    [string]$Theme = '商务谈判：让步与施压'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$LocalScript = Join-Path $ProjectRoot 'vocab-server\scripts\manual-daily-pack-cron.sh'
$RemoteScript = '/var/www/super-agent/vocab-server/scripts/manual-daily-pack-cron.sh'
$ServerHost = 'ubuntu@150.158.34.217'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Plink = 'C:\Program Files\PuTTY\plink.exe'

if (-not (Test-Path $LocalScript)) { throw "Missing local script: $LocalScript" }
if (-not (Test-Path $Pscp)) { throw "pscp not found: $Pscp" }
if (-not (Test-Path $Plink)) { throw "plink not found: $Plink" }

if (-not $SSHPassword) { $SSHPassword = $env:DEPLOY_SSH_PW }
if (-not $SSHPassword) {
    $sec = Read-Host 'Enter SSH password' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $SSHPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$raw = [IO.File]::ReadAllText($LocalScript) -replace "`r`n", "`n" -replace "`r", "`n"
[IO.File]::WriteAllText($LocalScript, $raw)

Write-Host '========== [A] upload bash script ==========' -ForegroundColor Cyan
& $Pscp -hostkey $HostKey -pw $SSHPassword -batch $LocalScript ($ServerHost + ':' + $RemoteScript)
if ($LASTEXITCODE -ne 0) { throw 'pscp upload failed' }

function Escape-BashSingle([string]$s) {
    return ($s -replace "'", "'\''")
}

$parts = New-Object System.Collections.Generic.List[string]
if ($SkipCron) { [void]$parts.Add('--skip-cron') }
if ($ListenToo) { [void]$parts.Add('--listen-too') }

if ($CronOnly) {
    [void]$parts.Add('--cron-only')
} else {
    if ([string]::IsNullOrWhiteSpace($UserId) -or [string]::IsNullOrWhiteSpace($Theme)) {
        throw 'Default mode needs -UserId and -Theme (or pass -CronOnly)'
    }
    [void]$parts.Add('--user')
    [void]$parts.Add("'" + (Escape-BashSingle $UserId) + "'")
    [void]$parts.Add('--theme')
    [void]$parts.Add("'" + (Escape-BashSingle $Theme) + "'")
}

$remoteArgs = ($parts -join ' ')
$remoteCmd = "chmod +x $RemoteScript && bash $RemoteScript $remoteArgs"

Write-Host '========== [B] run on server ==========' -ForegroundColor Cyan
Write-Host $remoteCmd -ForegroundColor DarkGray
& $Plink -hostkey $HostKey -pw $SSHPassword -batch $ServerHost $remoteCmd
if ($LASTEXITCODE -ne 0) { throw 'plink remote script failed' }

Write-Host ''
Write-Host 'Done. Soft-refresh frontend: English -> Daily Wakeup.' -ForegroundColor Green
