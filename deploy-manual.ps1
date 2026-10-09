# ============================================================
# Super-Agent Manual Deploy (no git commit/push)
# Mirrors deploy-smart.ps1 detection logic; default system ssh/scp
# ============================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-manual.ps1"
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-manual.ps1" -FrontendOnly
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-manual.ps1" -IncludeYml
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-manual.ps1" -Force
# PuTTY fallback:
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-manual.ps1" -UsePuTTY
# ============================================================

param(
    [switch]$UsePuTTY,
    [switch]$UseSystemSSH,
    [switch]$Force,
    [switch]$FrontendOnly,
    [switch]$BackendOnly,
    [switch]$IncludeYml,
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

Set-Location $ProjectRoot

# --- 1. Detect changes (same rules as deploy-smart.ps1) ---
Write-Host '========== Step 1: Scan Workspace Changes ==========' -ForegroundColor Cyan

$needFrontendDeploy = $false
$needBackendDeploy = $false
$needNginxDeploy = $false
$needYmlDeploy = $false
$needDocsDeploy = $false
$changedFiles = @()

if ($Force) {
    Write-Host 'Force: full deployment' -ForegroundColor Magenta
    $needFrontendDeploy = $true
    $needBackendDeploy = $true
    $needNginxDeploy = $true
    $needYmlDeploy = $true
} elseif ($FrontendOnly) {
    $needFrontendDeploy = $true
} elseif ($BackendOnly) {
    $needBackendDeploy = $true
} else {
    $branchName = (git branch --show-current)
    $diffFiles = @()
    try {
        $upstreamExists = git ls-remote --heads origin $branchName 2>$null
        if ($upstreamExists) {
            $diffFiles = git diff --name-only "origin/$branchName...HEAD" 2>$null
        }
    } catch {}

    $statusFiles = git status --porcelain | ForEach-Object { ($_ -replace '^\s*[MADRCU?]{1,2}\s+', '').Trim() }
    $changedFiles = @($diffFiles) + @($statusFiles) | Select-Object -Unique | Where-Object { $_ -ne '' }

    if ($changedFiles.Count -eq 0) {
        Write-Host 'No unstaged/unpushed changes; checking last commit...' -ForegroundColor Yellow
        $changedFiles = @(git diff --name-only HEAD~1 HEAD)
    }

    foreach ($file in $changedFiles) {
        if ($file -match '^src/' -or $file -match '^public/' -or $file -match 'index\.html$' -or $file -match 'vite\.config\.ts$' -or $file -match 'tsconfig\.json$' -or $file -match '^\.env') {
            $needFrontendDeploy = $true
        }
        if ($file -match '^vocab-server/') {
            $needBackendDeploy = $true
        }
        if ($file -match 'app\.liujingzhuwo\.site') {
            $needNginxDeploy = $true
        }
        if ($file -match '^yml/') {
            $needYmlDeploy = $true
        }
        if ($file -match '^docs/') {
            $needDocsDeploy = $true
        }
        if ($file -match '^package\.json$') {
            $needFrontendDeploy = $true
            $needBackendDeploy = $true
        }
    }

    if (-not $needFrontendDeploy -and -not $needBackendDeploy -and -not $needNginxDeploy -and -not $needYmlDeploy -and -not $needDocsDeploy) {
        Write-Host 'No targeted changes; defaulting to frontend deploy' -ForegroundColor Yellow
        $needFrontendDeploy = $true
    }
}

if ($IncludeYml) { $needYmlDeploy = $true }

Write-Host '[Plan]' -ForegroundColor DarkCyan
Write-Host "  Frontend : $needFrontendDeploy"
Write-Host "  Backend  : $needBackendDeploy"
Write-Host "  Nginx    : $needNginxDeploy"
Write-Host "  Yml      : $needYmlDeploy"
Write-Host "  Docs     : $needDocsDeploy"
if ($changedFiles.Count -gt 0) {
    Write-Host '  Changed files:'
    $changedFiles | ForEach-Object { Write-Host "    - $_" }
}
Write-Host ''

# --- 2. SSH setup ---
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
    param([string]$Label, [scriptblock]$Action)
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            & $Action
            if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
            return
        } catch {
            Write-Host "  [$Label] attempt $i/$MaxRetries failed: $($_.Exception.Message)" -ForegroundColor Yellow
            if ($i -eq $MaxRetries) { throw "[$Label] failed after $MaxRetries attempts" }
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
    Invoke-WithRetry -Label "scp $(Split-Path $Source -Leaf)" -Action {
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

    # --- Frontend ---
    if ($needFrontendDeploy) {
        Write-Host '========== Step 2: Frontend build & upload ==========' -ForegroundColor Cyan
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/dist/assets $RemoteWebRoot/dist/images/backgrounds"
        Send-File "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
        if (Test-Path "$ProjectRoot\dist\assets") {
            Send-File "$ProjectRoot\dist\assets" "$RemoteWebRoot/dist/"
        }
        if (Test-Path "$ProjectRoot\dist\images") {
            Send-File "$ProjectRoot\dist\images" "$RemoteWebRoot/dist/"
        }

        Invoke-RemoteCommand 'sudo nginx -t && sudo systemctl reload nginx'
        Write-Host '  Frontend deployed' -ForegroundColor Green
    } else {
        Write-Host '========== Step 2: Skip frontend ==========' -ForegroundColor DarkGray
    }

    # --- Backend ---
    if ($needBackendDeploy) {
        Write-Host '========== Step 3: Backend sync & restart ==========' -ForegroundColor Cyan

        if (-not $changedFiles -or @($changedFiles).Count -eq 0) {
            $changedFiles = @('vocab-server/server.js')
        }

        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Invoke-RemoteCommand "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak-$timestamp 2>/dev/null || true"

        foreach ($file in $changedFiles) {
            if ($file -match '^vocab-server/') {
                $relativePath = $file -replace '^vocab-server/', ''
                $localFile = "$ProjectRoot\vocab-server\$relativePath".Replace('/', '\')
                if (Test-Path $localFile -PathType Leaf) {
                    if ($relativePath.Contains('/')) {
                        $parts = $relativePath.Split('/')
                        $parentDir = [string]::Join('/', $parts[0..($parts.Length - 2)])
                        Invoke-RemoteCommand "mkdir -p $RemoteApiRoot/$parentDir"
                    }
                    Write-Host "  Upload: $relativePath"
                    Send-File $localFile "$RemoteApiRoot/$relativePath"
                }
            }
        }

        $envFile = "$ProjectRoot\vocab-server\.env"
        if (Test-Path $envFile -PathType Leaf) {
            Write-Host '  Upload: .env'
            Send-File $envFile "$RemoteApiRoot/.env"
        }

        if ($changedFiles -match 'vocab-server/package.json') {
            Invoke-RemoteCommand "cd $RemoteApiRoot && npm install"
        }

        Invoke-RemoteCommand 'sudo systemctl restart super-agent-vocab.service'
        Write-Host '  Backend restarted' -ForegroundColor Green
    } else {
        Write-Host '========== Step 3: Skip backend ==========' -ForegroundColor DarkGray
    }

    # --- Nginx config ---
    if ($needNginxDeploy) {
        Write-Host '========== Step 4: Nginx config ==========' -ForegroundColor Cyan
        Send-File "$ProjectRoot\app.liujingzhuwo.site" '/tmp/app.liujingzhuwo.site'
        Invoke-RemoteCommand 'sudo cp /tmp/app.liujingzhuwo.site /etc/nginx/sites-available/app.liujingzhuwo.site && sudo cp /tmp/app.liujingzhuwo.site /etc/nginx/sites-enabled/app.liujingzhuwo.site && sudo nginx -t && sudo systemctl reload nginx'
    } else {
        Write-Host '========== Step 4: Skip nginx config ==========' -ForegroundColor DarkGray
    }

    # --- Yml ---
    if ($needYmlDeploy) {
        Write-Host '========== Step 5: Upload yml ==========' -ForegroundColor Cyan
        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/yml"
        Get-ChildItem "$ProjectRoot\yml\*.yml" | ForEach-Object {
            Write-Host "  Upload: $($_.Name)"
            Send-File $_.FullName "$RemoteWebRoot/yml/$($_.Name)"
        }
    } else {
        Write-Host '========== Step 5: Skip yml ==========' -ForegroundColor DarkGray
    }

    # --- Docs ---
    if ($needDocsDeploy) {
        Write-Host '========== Step 6: Upload docs ==========' -ForegroundColor Cyan
        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/docs"
        Get-ChildItem "$ProjectRoot\docs" -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring("$ProjectRoot\docs\".Length).Replace('\', '/')
            $remoteDir = Split-Path $rel -Parent
            if ($remoteDir) {
                Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/docs/$remoteDir"
            }
            Send-File $_.FullName "$RemoteWebRoot/docs/$rel"
        }
    } else {
        Write-Host '========== Step 6: Skip docs ==========' -ForegroundColor DarkGray
    }

    # --- Health & logs ---
    Write-Host '========== Health check ==========' -ForegroundColor Cyan
    $health = Invoke-RemoteCommand 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/vocab/stats'
    Write-Host "  /api/vocab/stats HTTP $health"
    if ($health -ne '200') {
        Write-Host '  Warning: backend may be down (frontend static deploy can still succeed)' -ForegroundColor Yellow
    }

    Write-Host '========== Service logs (last 10 lines) ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand 'sudo journalctl -u super-agent-vocab.service -n 10 --no-pager || true'

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host ' Manual deploy done (no git commit/push)' -ForegroundColor Green
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
    Write-Host "  ssh $ServerHost echo ok"
    Write-Host '  Re-run without -UsePuTTY (default uses system ssh)'
    exit 1
}
finally {
    if ($UsePuTTYMode -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
