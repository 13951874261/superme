# ============================================================
# Manual incremental deploy (no git commit/push)
# Default: system ssh/scp (more stable than PuTTY on Windows)
# ============================================================
# Recommended:
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-oral-sandbox-round.ps1"
# Force PuTTY:
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-oral-sandbox-round.ps1" -UsePuTTY
# Include yml v8:
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-oral-sandbox-round.ps1" -IncludeYml
# ============================================================

param(
    [switch]$UsePuTTY,
    [switch]$UseSystemSSH,
    [switch]$IncludeYml,
    [string]$SSHPassword,
    [int]$MaxRetries = 3
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$HostKeyOptions = if ($HostKey) { @('-hostkey', $HostKey) } else { @() }
$SshOpts = @('-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-o', 'ConnectTimeout=25', '-o', 'StrictHostKeyChecking=accept-new')

Set-Location $ProjectRoot

Write-Host '========== Changes this round ==========' -ForegroundColor Cyan
Write-Host '  [frontend] src/components/modules/OralWarRoom.tsx'
if ($IncludeYml) {
    Write-Host '  [yml] yml/English_Oral_Sandbox (8).yml'
}
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
    Invoke-WithRetry -Label "scp $Source" -Action {
        if ($UsePuTTYMode) {
            if ($PlainPassword) {
                & $Pscp -r @HostKeyOptions -batch -pw $PlainPassword $Source "${ServerHost}:$Destination"
            } else {
                & $Pscp -r @HostKeyOptions -batch $Source "${ServerHost}:$Destination"
            }
        } else {
            & scp @SshOpts -r $Source "${ServerHost}:$Destination"
        }
    }
}

try {
    Write-Host '========== Step 0: SSH connectivity test ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand 'echo deploy-ok'
    Write-Host '  SSH OK' -ForegroundColor Green

    Write-Host '========== Step 1: Frontend build ==========' -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

    Write-Host '========== Step 2: Upload dist ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/dist"
    Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/dist/assets"
    Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/dist/images/backgrounds"
    if ($IncludeYml) {
        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/yml"
    }

    Send-File "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
    if (Test-Path "$ProjectRoot\dist\assets") {
        Send-File "$ProjectRoot\dist\assets" "$RemoteWebRoot/dist/"
    }
    if (Test-Path "$ProjectRoot\dist\images") {
        Send-File "$ProjectRoot\dist\images" "$RemoteWebRoot/dist/"
    }

    if ($IncludeYml) {
        Write-Host '========== Step 3: Upload yml v8 ==========' -ForegroundColor Cyan
        $ymlFile = "$ProjectRoot\yml\English_Oral_Sandbox (8).yml"
        if (-not (Test-Path $ymlFile)) { throw "Missing file: $ymlFile" }
        Send-File $ymlFile "$RemoteWebRoot/yml/English_Oral_Sandbox_v8.yml"
    }

    $nginxStep = if ($IncludeYml) { '4' } else { '3' }
    Write-Host "========== Step $nginxStep : Reload Nginx ==========" -ForegroundColor Cyan
    Invoke-RemoteCommand 'sudo nginx -t && sudo systemctl reload nginx'

    Write-Host '========== Health check ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand 'curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:3001/api/vocab/stats || true'

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host ' Deploy done' -ForegroundColor Green
    Write-Host ' https://app.liujingzhuwo.site/' -ForegroundColor Green
    Write-Host ' Hard refresh: Ctrl+Shift+R' -ForegroundColor Green
    Write-Host '=====================================================' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host 'DEPLOY FAILED' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ''
    Write-Host 'Troubleshooting:' -ForegroundColor Yellow
    Write-Host "  1. Test SSH manually:  ssh $ServerHost echo ok"
    Write-Host '  2. Re-run this script (default uses system ssh, not PuTTY)'
    Write-Host '  3. If using password auth, ensure server allows SSH from your IP'
    Write-Host '  4. Check cloud security group allows port 22'
    exit 1
}
finally {
    if ($UsePuTTYMode -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
