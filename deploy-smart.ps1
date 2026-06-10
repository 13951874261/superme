# ============================================================
# Super-Agent Smart Deploy Script
# Detects git changes and runs incremental deployments
# ============================================================

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfF'
$HostKeyOptions = @('-hostkey', $HostKey)

Set-Location $ProjectRoot

# 1. Detect code changes
Write-Host "========== Step 1: Scan Workspace Changes ==========" -ForegroundColor Cyan
$gitStatus = git status --porcelain
$changedFiles = $gitStatus | ForEach-Object { $_ -replace '^...|\s+$', '' }

$needFrontendDeploy = $false
$needBackendDeploy = $false
$needNginxDeploy = $false

if ($changedFiles.Count -eq 0) {
    Write-Host "No unstaged changes. Checking previous commit changes..." -ForegroundColor Yellow
    $changedFiles = git diff --name-only HEAD~1 HEAD
}

foreach ($file in $changedFiles) {
    if ($file -match "^src/" -or $file -match "^public/" -or $file -match "index\.html$" -or $file -match "vite\.config\.ts$" -or $file -match "tsconfig\.json$") {
        $needFrontendDeploy = $true
    }
    if ($file -match "^vocab-server/") {
        $needBackendDeploy = $true
    }
    if ($file -match "app\.liujingzhuwo\.site") {
        $needNginxDeploy = $true
    }
    if ($file -match "^package\.json$") {
        $needFrontendDeploy = $true
        $needBackendDeploy = $true
    }
}

if (-not $needFrontendDeploy -and -not $needBackendDeploy -and -not $needNginxDeploy) {
    Write-Host "No changes detected. Forcing full deployment!" -ForegroundColor Magenta
    $needFrontendDeploy = $true
    $needBackendDeploy = $true
    $needNginxDeploy = $true
}

Write-Host "[Analysis Results]" -ForegroundColor DarkCyan
Write-Host "Deploy Frontend: $needFrontendDeploy"
Write-Host "Deploy Backend: $needBackendDeploy"
Write-Host "Deploy Nginx Config: $needNginxDeploy"
Write-Host ""

# 2. SSH/SCP Setup
$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$UsePuTTY = $false

if ($UsePuTTY) {
    Write-Host "PuTTY found. Enabling auto-password mode." -ForegroundColor Green
    $Password = Read-Host 'Enter SSH password' -AsSecureString
    $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)
} else {
    Write-Host "Using system ssh/scp. You may need to enter password multiple times." -ForegroundColor Yellow
}

function Invoke-RemoteCommand {
    param([string]$Command)
    if ($UsePuTTY) {
        & $Plink @HostKeyOptions -pw $PlainPassword -batch $ServerHost $Command
    } else {
        ssh $ServerHost $Command
    }
    if ($LASTEXITCODE -ne 0) { throw "Command execution failed: $Command" }
}

function Send-File {
    param([string]$Source, [string]$Destination)
    if ($UsePuTTY) {
        & $Pscp -r @HostKeyOptions -pw $PlainPassword -batch $Source "${ServerHost}:$Destination"
    } else {
        scp -r $Source "${ServerHost}:$Destination"
    }
    if ($LASTEXITCODE -ne 0) { throw "File upload failed: $Source -> $Destination" }
}

try {
    # 3. Frontend Deployment
    if ($needFrontendDeploy) {
        Write-Host "========== Step 2: Frontend Build and Sync ==========" -ForegroundColor Cyan
        Write-Host "  -> pnpm build" -ForegroundColor DarkCyan
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }

        Write-Host "  -> Uploading frontend artifacts" -ForegroundColor DarkCyan
        Send-File "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
        Send-File "$ProjectRoot\dist\*" "$RemoteWebRoot/dist/"
        
        Write-Host "  -> Nginx Reload" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo nginx -t && sudo systemctl reload nginx"
    } else {
        Write-Host "========== Step 2: Skip Frontend ==========" -ForegroundColor DarkGray
    }

    # 4. Backend Deployment
    if ($needBackendDeploy) {
        Write-Host ""
        Write-Host "========== Step 3: Backend Sync and Restart ==========" -ForegroundColor Cyan
        
        Write-Host "  -> Backup server.js on remote" -ForegroundColor DarkCyan
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Invoke-RemoteCommand "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak-$timestamp"
        
        Write-Host "  -> Uploading changed backend files" -ForegroundColor DarkCyan
        foreach ($file in $changedFiles) {
            if ($file -match "^vocab-server/") {
                $relativePath = $file -replace '^vocab-server/', ''
                $localFile = "$ProjectRoot\vocab-server\$relativePath".Replace('/', '\')
                if (Test-Path $localFile -PathType Leaf) {
                    if ($relativePath.Contains('/')) {
                        $parts = $relativePath.Split('/')
                        $dirParts = $parts[0..($parts.Length - 2)]
                        $parentDir = [string]::Join('/', $dirParts)
                        Invoke-RemoteCommand "mkdir -p $RemoteApiRoot/$parentDir"
                    }
                    Write-Host "     Uploading: $relativePath"
                    Send-File $localFile "$RemoteApiRoot/$relativePath"
                }
            }
        }
        if ($changedFiles -match "vocab-server/package.json") {
            Write-Host "  -> Installing backend dependencies" -ForegroundColor DarkCyan
            Invoke-RemoteCommand "cd $RemoteApiRoot && npm install"
        }
        
        if ($changedFiles -match "super-agent-vocab.service") {
            Send-File "$ProjectRoot\scratch\super-agent-vocab.service" "/tmp/super-agent-vocab.service"
            Invoke-RemoteCommand "sudo cp /tmp/super-agent-vocab.service /etc/systemd/system/ && sudo systemctl daemon-reload"
        }
 
        Write-Host "  -> Restarting vocab service" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo systemctl restart super-agent-vocab.service"
    } else {
        Write-Host ""
        Write-Host "========== Step 3: Skip Backend ==========" -ForegroundColor DarkGray
    }

    # 5. Nginx Config Deployment
    if ($needNginxDeploy) {
        Write-Host ""
        Write-Host "========== Step 4: Nginx Sync and Reload ==========" -ForegroundColor Cyan
        Send-File "$ProjectRoot\app.liujingzhuwo.site" "/tmp/app.liujingzhuwo.site"
        Invoke-RemoteCommand "sudo cp /tmp/app.liujingzhuwo.site /etc/nginx/sites-available/app.liujingzhuwo.site && sudo cp /tmp/app.liujingzhuwo.site /etc/nginx/sites-enabled/app.liujingzhuwo.site && sudo nginx -t && sudo systemctl reload nginx"
        Write-Host "  -> Nginx config synced and reloaded successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "========== Step 4: Skip Nginx Config ==========" -ForegroundColor DarkGray
    }

    # 6. Service Status & Logs
    Write-Host ""
    Write-Host "========== Step 5: Service Status & Logs ==========" -ForegroundColor Cyan
    Write-Host "--- Node Service Logs (Last 20 lines) ---" -ForegroundColor DarkCyan
    Invoke-RemoteCommand "sudo journalctl -u super-agent-vocab.service -n 20 --no-pager"
    Write-Host "--- Nginx Error Logs (Last 20 lines) ---" -ForegroundColor DarkCyan
    Invoke-RemoteCommand "sudo tail -n 20 /var/log/nginx/error.log"

    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host " 🎉 Smart Deploy Completed!" -ForegroundColor Green
    Write-Host " 🌐 URL: https://app.liujingzhuwo.site/" -ForegroundColor Green
    Write-Host " 💡 Please press Ctrl+Shift+R to force refresh." -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
}
finally {
    if ($UsePuTTY -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
