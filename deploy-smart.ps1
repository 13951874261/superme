# ============================================================
# Super-Agent Smart Deploy Script
# Detects git changes and runs incremental deployments
# ============================================================

param(
    [switch]$UseSystemSSH,
    [string]$CommitMessage = "",
    [switch]$Force,
    [switch]$FrontendOnly,
    [switch]$BackendOnly,
    [string]$SSHPassword
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$HostKeyOptions = if ($HostKey) { @("-hostkey", $HostKey) } else { @() }

Set-Location $ProjectRoot

# 1. Detect code changes
Write-Host "========== Step 1: Scan Workspace Changes ==========" -ForegroundColor Cyan

$needFrontendDeploy = $false
$needBackendDeploy = $false
$needNginxDeploy = $false
$saveEnvHash = $null

# Always collect changed files so -BackendOnly / -Force still upload the right backend paths
# (Previously -BackendOnly skipped this scan and defaulted to server.js only, missing e.g. services/webFetcher.js)
$branchName = (git branch --show-current)
$diffFiles = @()
try {
    $upstreamExists = git ls-remote --heads origin $branchName 2>$null
    if ($upstreamExists) {
        $diffFiles = git diff --name-only "origin/$branchName...HEAD" 2>$null
    }
} catch {}

$statusFiles = git status --porcelain | ForEach-Object {
    if ($_ -match '^(..)\s+(.*)$') { $matches[2] } else { $_ -replace '^...|\s+$', '' }
}
$changedFiles = @($diffFiles) + @($statusFiles) | Select-Object -Unique | Where-Object { $_ -ne '' }

if (@($changedFiles).Count -eq 0) {
    Write-Host "No unstaged or unpushed changes. Checking previous commit changes..." -ForegroundColor Yellow
    $changedFiles = @(git diff --name-only HEAD~1 HEAD)
}

if ($Force) {
    Write-Host "Force switch is active. Enabling full deployment!" -ForegroundColor Magenta
    $needFrontendDeploy = $true
    $needBackendDeploy = $true
    $needNginxDeploy = $true
} elseif ($FrontendOnly) {
    Write-Host "FrontendOnly switch is active. Deploying frontend only!" -ForegroundColor Magenta
    $needFrontendDeploy = $true
} elseif ($BackendOnly) {
    Write-Host "BackendOnly switch is active. Deploying backend only!" -ForegroundColor Magenta
    $needBackendDeploy = $true
    $backendChanged = @($changedFiles | Where-Object { $_ -match '^vocab-server/' })
    if ($backendChanged.Count -eq 0) {
        Write-Host "No vocab-server paths in scan; including HEAD~1..HEAD vocab-server files." -ForegroundColor Yellow
        $changedFiles = @(git diff --name-only HEAD~1 HEAD -- vocab-server/)
        if (@($changedFiles).Count -eq 0) {
            $changedFiles = @('vocab-server/server.js', 'vocab-server/services/gtCaseQuality.js', 'vocab-server/services/gameTheoryCasePushService.js', 'vocab-server/services/gameTheoryVerdictGuard.js', 'vocab-server/services/insightSpeakProxy.js', 'vocab-server/services/scriptEvaluator.js', 'vocab-server/services/insightScenarioFallbacks.json', 'vocab-server/services/insightScenarioScript.js', 'vocab-server/services/webFetcher.js')
            Write-Host "Fallback upload list: server.js + services/gtCaseQuality.js + services/gameTheoryCasePushService.js + services/gameTheoryVerdictGuard.js + services/insightSpeakProxy.js + services/scriptEvaluator.js + services/insightScenarioFallbacks.json + services/insightScenarioScript.js + services/webFetcher.js" -ForegroundColor Yellow
        }
    }
} else {
    foreach ($file in $changedFiles) {
        if ($file -match "^src/" -or $file -match "^public/" -or $file -match "index\.html$" -or $file -match "vite\.config\.ts$" -or $file -match "tsconfig\.json$" -or $file -match "^\.env") {
            $needFrontendDeploy = $true
        }
        if ($file -match "^vocab-server/") {
            $needBackendDeploy = $true
        }
        if ($file -eq "vocab-server/.env") {
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

    $envFile = "$ProjectRoot\vocab-server\.env"
    if (Test-Path $envFile -PathType Leaf) {
        $envHashFile = "$ProjectRoot\.deploy_env_hash"
        $currentHash = (Get-FileHash $envFile).Hash
        $prevHash = ""
        if (Test-Path $envHashFile -PathType Leaf) {
            $prevHash = (Get-Content $envHashFile -Raw).Trim()
        }
        if ($currentHash -ne $prevHash) {
            Write-Host "Detected changes in vocab-server/.env. Forcing backend deploy." -ForegroundColor Magenta
            $needBackendDeploy = $true
            $saveEnvHash = $currentHash
        }
    }

    if (-not $needFrontendDeploy -and -not $needBackendDeploy -and -not $needNginxDeploy) {
        Write-Host "No changes detected. Forcing full deployment!" -ForegroundColor Magenta
        $needFrontendDeploy = $true
        $needBackendDeploy = $true
        $needNginxDeploy = $true
    }
}

if ((Test-Path "$ProjectRoot\vocab-server\.env" -PathType Leaf) -and $needBackendDeploy) {
    Write-Host "Local vocab-server/.env found; will sync to server during backend deploy." -ForegroundColor DarkGreen
}

Write-Host "[Analysis Results]" -ForegroundColor DarkCyan
Write-Host "Deploy Frontend: $needFrontendDeploy"
Write-Host "Deploy Backend: $needBackendDeploy"
Write-Host "Deploy Nginx Config: $needNginxDeploy"
Write-Host ""

# 2. SSH/SCP Setup
$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$UsePuTTY = ($null -ne $Pscp) -and ($null -ne $Plink) -and (-not $UseSystemSSH)

if ($UsePuTTY) {
    Write-Host "PuTTY found. Enabling auto-password mode (leave empty if using SSH key/Pageant)." -ForegroundColor Green
    $PasswordPtr = [IntPtr]::Zero
    if ($SSHPassword) {
        $PlainPassword = $SSHPassword
    } else {
        $Password = Read-Host 'Enter SSH password' -AsSecureString
        $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
        $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)
    }
} else {
    Write-Host "Using system ssh/scp. You may need to enter password or use local SSH keys." -ForegroundColor Yellow
}

function Invoke-RemoteCommand {
    param([string]$Command)
    if ($UsePuTTY) {
        if ($PlainPassword) {
            & $Plink @HostKeyOptions -pw $PlainPassword -batch $ServerHost $Command
        } else {
            & $Plink @HostKeyOptions -batch $ServerHost $Command
        }
    } else {
        ssh $ServerHost $Command
    }
    if ($LASTEXITCODE -ne 0) { throw "Command execution failed: $Command" }
}

function Send-File {
    param([string]$Source, [string]$Destination)
    if ($UsePuTTY) {
        if ($PlainPassword) {
            & $Pscp -r @HostKeyOptions -pw $PlainPassword -batch $Source "${ServerHost}:$Destination"
        } else {
            & $Pscp -r @HostKeyOptions -batch $Source "${ServerHost}:$Destination"
        }
    } else {
        scp -r $Source "${ServerHost}:$Destination"
    }
    if ($LASTEXITCODE -ne 0) { throw "File upload failed: $Source -> $Destination" }
}

try {
    # 3. Frontend Deployment
    if ($needFrontendDeploy) {
        Write-Host "========== Step 2: Frontend Build and Sync ==========" -ForegroundColor Cyan
        Write-Host "  -> pnpm install" -ForegroundColor DarkCyan
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependencies installation failed' }

        Write-Host "  -> pnpm build" -ForegroundColor DarkCyan
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }

        Write-Host "  -> Uploading frontend artifacts" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/dist/images/backgrounds $RemoteWebRoot/dist/assets"
        Send-File "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
        if (Test-Path "$ProjectRoot\dist\assets") {
            Send-File "$ProjectRoot\dist\assets" "$RemoteWebRoot/dist/"
        }
        if (Test-Path "$ProjectRoot\dist\images") {
            Send-File "$ProjectRoot\dist\images" "$RemoteWebRoot/dist/"
        }
        
        Write-Host "  -> Nginx Reload" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo nginx -t && sudo systemctl reload nginx"
    } else {
        Write-Host "========== Step 2: Skip Frontend ==========" -ForegroundColor DarkGray
    }

    # 4. Backend Deployment
    if ($needBackendDeploy) {
        Write-Host ""
        Write-Host "========== Step 3: Backend Sync and Restart ==========" -ForegroundColor Cyan
        if (-not $changedFiles -or @($changedFiles).Count -eq 0) {
            $changedFiles = @(
                'vocab-server/server.js',
                'vocab-server/services/gtCaseQuality.js',
                'vocab-server/services/gameTheoryCasePushService.js',
                'vocab-server/services/gameTheoryVerdictGuard.js',
                'vocab-server/services/insightSpeakProxy.js',
                'vocab-server/services/scriptEvaluator.js',
                'vocab-server/services/insightScenarioFallbacks.json',
                'vocab-server/services/insightScenarioScript.js',
                'vocab-server/services/dailyListenPreGenerateService.js',
                'vocab-server/services/dailyPackService.js',
                'vocab-server/services/dailyPackCron.js',
                'vocab-server/scripts/generate-all-1min-lzhmy.js',
                'vocab-server/scripts/simulate-frontend-full-generate.js',
                'vocab-server/scripts/run-real-2am-lzhmy.js',
                'vocab-server/scripts/simulate-1min-full-cron.js',
                'vocab-server/scripts/query-1min-verify.js',
                'vocab-server/scripts/upsert-user.js',
                'vocab-server/scripts/locate-data.js',
                'vocab-server/scripts/print-articles.js',
                'vocab-server/scripts/run-full-production-ready.js',
                'vocab-server/scripts/test-single-1min.js',
                'vocab-server/scripts/print-schema.js'
            )
            Write-Host "  -> No changed-file list; defaulting to full core backend & script set" -ForegroundColor Yellow
        }

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

        $envFile = "$ProjectRoot\vocab-server\.env"
        if (Test-Path $envFile -PathType Leaf) {
            Write-Host "  -> Uploading vocab-server/.env -> $RemoteApiRoot/.env" -ForegroundColor DarkCyan
            Send-File $envFile "$RemoteApiRoot/.env"
        } else {
            Write-Host "  -> Skip .env (local vocab-server/.env not found)" -ForegroundColor Yellow
        }

        $runFixOldVocab = $false
        foreach ($file in $changedFiles) {
            if ($file -match "vocab-server/scripts/fix_old_vocab.cjs") {
                $runFixOldVocab = $true
            }
        }

        if ($runFixOldVocab) {
            Write-Host "  -> Running database fix script: fix_old_vocab.cjs" -ForegroundColor DarkCyan
            Invoke-RemoteCommand "node $RemoteApiRoot/scripts/fix_old_vocab.cjs"
        }
        if ($changedFiles -match "vocab-server/package.json") {
            Write-Host "  -> Installing backend dependencies" -ForegroundColor DarkCyan
            Invoke-RemoteCommand "cd $RemoteApiRoot && npm install"
        }

        $edgeTtsInstall = "$ProjectRoot\scripts\install-edge-tts-server.sh"
        if (Test-Path $edgeTtsInstall -PathType Leaf) {
            Write-Host "  -> Ensuring edge-tts is installed on server" -ForegroundColor DarkCyan
            Send-File $edgeTtsInstall "/tmp/install-edge-tts-server.sh"
            Invoke-RemoteCommand "chmod +x /tmp/install-edge-tts-server.sh && bash /tmp/install-edge-tts-server.sh"
        }
        
        if ($changedFiles -match "super-agent-vocab.service") {
            Send-File "$ProjectRoot\scratch\super-agent-vocab.service" "/tmp/super-agent-vocab.service"
            Invoke-RemoteCommand "sudo cp /tmp/super-agent-vocab.service /etc/systemd/system/ && sudo systemctl daemon-reload"
        }
 
        Write-Host "  -> Restarting vocab service" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo systemctl restart super-agent-vocab.service"

        if ($saveEnvHash) {
            $saveEnvHash | Out-File -FilePath "$ProjectRoot\.deploy_env_hash" -NoNewline
            Write-Host "  -> Saved new .env hash to local cache." -ForegroundColor DarkGreen
        }
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

    # 6. Git Commit & Push to GitHub
    Write-Host ""
    Write-Host "========== Step 6: Git Push to GitHub ==========" -ForegroundColor Cyan
    $branchName = (git branch --show-current)
    Write-Host "Current branch: $branchName"

    # Prefer 10808, then 7897; if neither is up, push direct (avoid stale proxy in .git/config)
    $proxyHelper = Join-Path $ProjectRoot 'scripts\resolve-git-proxy.ps1'
    if (Test-Path $proxyHelper -PathType Leaf) {
        . $proxyHelper
        Set-LocalGitProxy | Out-Null
    }
    
    $gitDiffStatus = git status --porcelain
    if ($gitDiffStatus) {
        Write-Host "Staging and committing files..." -ForegroundColor DarkCyan
        git add -A
        if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
            $CommitMessage = "chore: auto deploy update"
        }
        $finalCommitMsg = "$CommitMessage $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git commit -m $finalCommitMsg
    } else {
        Write-Host "No local changes to commit." -ForegroundColor Yellow
    }

    Write-Host "Pushing to GitHub..." -ForegroundColor DarkCyan
    git push origin $branchName
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Git push succeeded!" -ForegroundColor Green
    } else {
        Write-Host "Warning: Git push failed!" -ForegroundColor Red
    }

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
