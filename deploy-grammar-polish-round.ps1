# ============================================================
# Grammar Polish Engine — Manual incremental deploy (no git push)
# Round: Time-aware Grammar_Polish_Engine + /api/grammar-polish injectOralSystemTime
# Default: system ssh/scp
# ============================================================
# Recommended (backend + yml):
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-grammar-polish-round.ps1"
#
# Backend only (skip yml upload):
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-grammar-polish-round.ps1" -BackendOnly
#
# Yml only (skip backend restart):
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-grammar-polish-round.ps1" -YmlOnly
#
# Force PuTTY:
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-grammar-polish-round.ps1" -UsePuTTY
# ============================================================

param(
    [switch]$UsePuTTY,
    [switch]$UseSystemSSH,
    [switch]$BackendOnly,
    [switch]$YmlOnly,
    [string]$SSHPassword,
    [int]$MaxRetries = 3
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$HostKeyOptions = if ($HostKey) { @('-hostkey', $HostKey) } else { @() }
$SshOpts = @('-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-o', 'ConnectTimeout=25', '-o', 'StrictHostKeyChecking=accept-new')

$needBackend = -not $YmlOnly
$needYml = -not $BackendOnly

Set-Location $ProjectRoot

Write-Host '========== Changes this round ==========' -ForegroundColor Cyan
if ($needBackend) {
    Write-Host '  [backend] vocab-server/server.js  -> injectOralSystemTime for /api/grammar-polish'
}
if ($needYml) {
    Write-Host '  [yml]     yml/time_base/Grammar_Polish_Engine.yml  -> time-aware workflow DSL'
}
Write-Host ''
Write-Host 'Post-deploy (manual on Dify):' -ForegroundColor Yellow
Write-Host '  1. Open Grammar_Polish_Engine (app-547Sa5oIC3Qb9RUZdasJs1Ef)'
Write-Host '  2. Import DSL from server copy or local yml/time_base/Grammar_Polish_Engine.yml'
Write-Host '  3. Publish update'
Write-Host ''

$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$HasPuTTY = ($null -ne $Pscp) -and ($null -ne $Plink)
$UsePuTTYMode = $UsePuTTY -and $HasPuTTY -and (-not $UseSystemSSH)

if (-not $UsePuTTYMode) {
    Write-Host 'Using system ssh/scp (recommended)' -ForegroundColor Green
    $null = Get-Command ssh -ErrorAction Stop
    $null = Get-Command scp -ErrorAction Stop
} else {
    Write-Host 'Using PuTTY plink/pscp' -ForegroundColor Yellow
    $PasswordPtr = [IntPtr]::Zero
    if ($SSHPassword) {
        $PlainPassword = $SSHPassword
    } else {
        $Password = Read-Host 'Enter SSH password' -AsSecureString
        $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
        $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)
    }
}

function Invoke-WithRetry {
    param(
        [string]$Label,
        [scriptblock]$Action
    )
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            & $Action
            if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
            return
        } catch {
            $msg = $_.Exception.Message
            Write-Host "  [$Label] attempt $i/$MaxRetries failed: $msg" -ForegroundColor Yellow
            if ($i -eq $MaxRetries) {
                throw "[$Label] failed after $MaxRetries attempts. Try: ssh $ServerHost echo ok"
            }
            Start-Sleep -Seconds (2 * $i)
        }
    }
}

function Invoke-RemoteCommand {
    param([string]$Command)
    Invoke-WithRetry -Label 'ssh' -Action {
        if ($UsePuTTYMode) {
            if ($PlainPassword) {
                & $Plink @HostKeyOptions -ssh -batch -pw $PlainPassword $ServerHost $Command
            } else {
                & $Plink @HostKeyOptions -ssh -batch $ServerHost $Command
            }
        } else {
            & ssh @SshOpts $ServerHost $Command
        }
    }
}

function Send-File {
    param([string]$Source, [string]$Destination)
    if (-not (Test-Path $Source -PathType Leaf)) {
        throw "Missing local file: $Source"
    }
    Invoke-WithRetry -Label "scp $(Split-Path $Source -Leaf)" -Action {
        if ($UsePuTTYMode) {
            if ($PlainPassword) {
                & $Pscp @HostKeyOptions -batch -pw $PlainPassword $Source "${ServerHost}:$Destination"
            } else {
                & $Pscp @HostKeyOptions -batch $Source "${ServerHost}:$Destination"
            }
        } else {
            & scp @SshOpts $Source "${ServerHost}:$Destination"
        }
    }
}

try {
    Write-Host '========== Step 0: SSH connectivity test ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand 'echo deploy-ok'
    Write-Host '  SSH OK' -ForegroundColor Green

    if ($needBackend) {
        Write-Host '========== Step 1: Backend sync & restart ==========' -ForegroundColor Cyan

        $serverJs = "$ProjectRoot\vocab-server\server.js"
        if (-not (Test-Path $serverJs)) { throw "Missing file: $serverJs" }

        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Invoke-RemoteCommand "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak-$timestamp 2>/dev/null || true"

        Write-Host '  Upload: server.js'
        Send-File $serverJs "$RemoteApiRoot/server.js"

        $envFile = "$ProjectRoot\vocab-server\.env"
        if (Test-Path $envFile -PathType Leaf) {
            Write-Host '  Upload: .env'
            Send-File $envFile "$RemoteApiRoot/.env"
        } else {
            Write-Host '  Skip .env (local not found)' -ForegroundColor Yellow
        }

        Write-Host '  Restart: super-agent-vocab.service'
        Invoke-RemoteCommand 'sudo systemctl restart super-agent-vocab.service'
        Write-Host '  Backend restarted' -ForegroundColor Green
    } else {
        Write-Host '========== Step 1: Skip backend ==========' -ForegroundColor DarkGray
    }

    if ($needYml) {
        Write-Host '========== Step 2: Upload workflow DSL ==========' -ForegroundColor Cyan

        $ymlFile = "$ProjectRoot\yml\time_base\Grammar_Polish_Engine.yml"
        if (-not (Test-Path $ymlFile)) { throw "Missing file: $ymlFile" }

        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/yml/time_base"
        Write-Host '  Upload: yml/time_base/Grammar_Polish_Engine.yml'
        Send-File $ymlFile "$RemoteWebRoot/yml/time_base/Grammar_Polish_Engine.yml"
        Write-Host '  Yml synced to server' -ForegroundColor Green
    } else {
        Write-Host '========== Step 2: Skip yml ==========' -ForegroundColor DarkGray
    }

    Write-Host '========== Step 3: Health check ==========' -ForegroundColor Cyan
    $health = Invoke-RemoteCommand 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/vocab/stats'
    Write-Host "  /api/vocab/stats HTTP $health"
    if ($health -ne '200') {
        Write-Host '  Warning: backend may be unhealthy (service status below)' -ForegroundColor Yellow
    }
    $svcStatus = Invoke-RemoteCommand 'sudo systemctl is-active super-agent-vocab.service || true'
    Write-Host "  super-agent-vocab.service: $svcStatus"

    Write-Host ''
    Write-Host '========== Service logs (last 15 lines) ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand 'sudo journalctl -u super-agent-vocab.service -n 15 --no-pager || true'

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host ' Grammar Polish round deploy done (no git commit/push)' -ForegroundColor Green
    Write-Host ' https://app.liujingzhuwo.site/' -ForegroundColor Green
    Write-Host ''
    Write-Host ' Next: Import yml/time_base/Grammar_Polish_Engine.yml into Dify' -ForegroundColor Yellow
    Write-Host '       and publish Grammar_Polish_Engine workflow.' -ForegroundColor Yellow
    Write-Host '=====================================================' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host 'DEPLOY FAILED' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ''
    Write-Host 'Troubleshooting:' -ForegroundColor Yellow
    Write-Host "  ssh $ServerHost echo ok"
    Write-Host '  curl http://127.0.0.1:3001/api/vocab/stats  (on server)'
    Write-Host '  sudo systemctl status super-agent-vocab.service  (on server)'
    exit 1
}
finally {
    if ($UsePuTTYMode -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
