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
    [SecureString]$SSHPassword
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$RemoteReleaseBase = '/var/backups/super-agent/releases'
$BookLightDeployScript = "$ProjectRoot\scripts\deploy-book-light.sh"
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$HostKeyOptions = if ($HostKey) { @("-hostkey", $HostKey) } else { @() }

Set-Location $ProjectRoot

# 1. Detect code changes
Write-Host "========== Step 1: Scan Workspace Changes ==========" -ForegroundColor Cyan

$needFrontendDeploy = $false
$needBackendDeploy = $false
$needNginxDeploy = $false
$saveEnvHash = $null

Write-Host "  -> Book MVP release gate" -ForegroundColor DarkCyan
if ($env:BOOK_MVP_SKIP_HUMAN_GATE -eq 'true') {
    if ([string]::IsNullOrWhiteSpace($env:BOOK_MVP_HUMAN_GATE_AUTHORIZED_AT) -or [string]::IsNullOrWhiteSpace($env:BOOK_MVP_HUMAN_GATE_REASON)) {
        throw 'Human gate skip requires BOOK_MVP_HUMAN_GATE_AUTHORIZED_AT and BOOK_MVP_HUMAN_GATE_REASON'
    }
    Write-Warning "HUMAN REVIEW GATE SKIPPED; humanReviewSkipped=true; authorizedAt=$env:BOOK_MVP_HUMAN_GATE_AUTHORIZED_AT; reason=$env:BOOK_MVP_HUMAN_GATE_REASON; reviewer=null"
}
npm run verify:book-mvp
if ($LASTEXITCODE -ne 0) { throw 'Book MVP release gate failed' }

# Always collect changed files so -BackendOnly / -Force still upload the right backend paths
# (Previously -BackendOnly skipped this scan and defaulted to server.js only, missing e.g. services/webFetcher.js)
$branchName = (git branch --show-current)
$diffFiles = @()
try {
    $upstreamExists = git ls-remote --heads origin $branchName 2>$null
    if ($upstreamExists) {
        $diffFiles = git diff --name-only "origin/$branchName...HEAD" 2>$null
    }
} catch { Write-Warning "Remote branch lookup failed: $($_.Exception.Message)" }

$statusFiles = git status --porcelain | ForEach-Object {
    if ($_ -match '^(..)\s+(.*)$') { $matches[2] } else { $_ -replace '^...|\s+$', '' }
}
$untrackedFiles = @(git ls-files --others --exclude-standard)
$changedFiles = @($diffFiles) + @($statusFiles) + $untrackedFiles | Select-Object -Unique | Where-Object { $_ -ne '' }

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
        $changedFiles = @(git diff --name-only HEAD~1 HEAD -- vocab-server/)
        if (@($changedFiles).Count -eq 0) {
            $changedFiles = @(
                'vocab-server/server.js',
                'vocab-server/services/audioTranscriptionService.js',
                'vocab-server/services/englishWorkflowProxy.js',
                'vocab-server/services/gtCaseQuality.js',
                'vocab-server/services/toneCorrections.js',
                'vocab-server/services/gameTheorySessionService.js',
                'vocab-server/services/gameTheoryCasePushService.js',
                'vocab-server/services/gameTheoryVerdictGuard.js',
                'vocab-server/services/insightSpeakProxy.js',
                'vocab-server/services/scriptEvaluator.js',
                'vocab-server/services/insightScenarioFallbacks.json',
                'vocab-server/services/insightScenarioScript.js',
                'vocab-server/services/webFetcher.js',
                'vocab-server/services/vaultRefine.js',
                'vocab-server/services/vaultRefineDepthQuality.js',
                'vocab-server/services/moduleHardnessQuality.js',
                'vocab-server/services/gameTheoryKnowledge.js',
                'vocab-server/services/knowledgeTheoryNodes.js',
                'vocab-server/services/knowledgeVaultExtra.js',
                'vocab-server/services/listenAnalysisService.js',
                'vocab-server/services/dailyListenPreGenerateService.js',
                'vocab-server/services/dailyPackService.js',
                'vocab-server/services/dailyPackCron.js',
                'vocab-server/tests/audioTranscriptionConcurrency.test.js',
                'vocab-server/tests/oralChatStream.test.js',
                'vocab-server/tests/listenBackfillSla.test.js',
                'vocab-server/tests/dailyPackTodaySla.test.js',
                'vocab-server/tests/writeGovernanceStreamNoFallback.test.js',
                'vocab-server/tests/gameTheoryRoundStream.test.js',
                'vocab-server/tests/vocabQueryPerf.test.js',
                'vocab-server/scripts/backfill-dict-level.js',
                'vocab-server/scripts/backfill_dict_level.py'
            )

            Write-Host "Fallback upload list: core server + all services + SLA tests" -ForegroundColor Yellow
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

    if (-not $needFrontendDeploy -and -not $needBackendDeploy -and -not $needNginxDeploy) {
        Write-Host "No changes detected. Forcing full deployment!" -ForegroundColor Magenta
        $needFrontendDeploy = $true
        $needBackendDeploy = $true
        $needNginxDeploy = $true
    }
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
        $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SSHPassword)
        $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordPtr)
    } else {
        $PlainPassword = $null
        Write-Host "No password supplied; using SSH key/Pageant." -ForegroundColor Green
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
        $EncodedCommand = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Command))
        ssh $ServerHost "echo $EncodedCommand | base64 -d | bash"
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

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteReleaseRoot = "$RemoteReleaseBase/release-$timestamp"
$frontendSwapped = $false
$backendTouched = $false
$serviceConfigTouched = $false
$nginxConfigTouched = $false

try {
    Invoke-RemoteCommand "sudo mkdir -p $remoteReleaseRoot && sudo chown ubuntu:ubuntu $remoteReleaseRoot && test -d $remoteReleaseRoot && test -w $remoteReleaseRoot"
    if ($env:BOOK_MVP_PROFILE -eq 'light') {
        if (-not (Test-Path $BookLightDeployScript -PathType Leaf)) { throw 'Light deployment script missing' }
        Write-Host "  -> Safe light profile deployment" -ForegroundColor DarkCyan
        Send-File $BookLightDeployScript '/tmp/deploy-book-light.sh'
        Invoke-RemoteCommand "sed -i 's/\r$//' /tmp/deploy-book-light.sh && chmod 0700 /tmp/deploy-book-light.sh && bash -n /tmp/deploy-book-light.sh && bash /tmp/deploy-book-light.sh --self-check && test -d $remoteReleaseRoot && test -w $remoteReleaseRoot"
    }
    # 3. Frontend Deployment
    if ($needFrontendDeploy) {
        Write-Host "========== Step 2: Frontend Build and Sync ==========" -ForegroundColor Cyan
        Write-Host "  -> pnpm install" -ForegroundColor DarkCyan
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependencies installation failed' }

        Write-Host "  -> pnpm build" -ForegroundColor DarkCyan
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }

        Write-Host "  -> Uploading frontend release" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "mkdir -p $remoteReleaseRoot/dist"
        Send-File "$ProjectRoot\dist" "$remoteReleaseRoot/"
        Invoke-RemoteCommand "if [ -d $RemoteWebRoot/dist ]; then mv $RemoteWebRoot/dist $remoteReleaseRoot/dist.previous; fi; mv $remoteReleaseRoot/dist $RemoteWebRoot/dist"
        $frontendSwapped = $true

        Write-Host "  -> Nginx Reload" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo mkdir -p /var/log/nginx && sudo nginx -t && sudo systemctl reload nginx"
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
                'vocab-server/services/audioTranscriptionService.js',
                'vocab-server/services/englishWorkflowProxy.js',
                'vocab-server/services/gtCaseQuality.js',
                'vocab-server/services/toneCorrections.js',
                'vocab-server/services/gameTheorySessionService.js',
                'vocab-server/services/gameTheoryCasePushService.js',
                'vocab-server/services/gameTheoryVerdictGuard.js',
                'vocab-server/services/insightSpeakProxy.js',
                'vocab-server/services/scriptEvaluator.js',
                'vocab-server/services/insightScenarioFallbacks.json',
                'vocab-server/services/insightScenarioScript.js',
                'vocab-server/services/webFetcher.js',
                'vocab-server/services/vaultRefine.js',
                'vocab-server/services/vaultRefineDepthQuality.js',
                'vocab-server/services/moduleHardnessQuality.js',
                'vocab-server/services/gameTheoryKnowledge.js',
                'vocab-server/services/knowledgeTheoryNodes.js',
                'vocab-server/services/knowledgeVaultExtra.js',
                'vocab-server/services/listenAnalysisService.js',
                'vocab-server/services/dailyListenPreGenerateService.js',
                'vocab-server/services/dailyPackService.js',
                'vocab-server/services/dailyPackCron.js',
                'vocab-server/tests/audioTranscriptionConcurrency.test.js',
                'vocab-server/tests/oralChatStream.test.js',
                'vocab-server/tests/listenBackfillSla.test.js',
                'vocab-server/tests/dailyPackTodaySla.test.js',
                'vocab-server/tests/writeGovernanceStreamNoFallback.test.js',
                'vocab-server/tests/gameTheoryRoundStream.test.js',
                'vocab-server/tests/vocabQueryPerf.test.js',
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
                'vocab-server/scripts/print-schema.js',
                'vocab-server/scripts/backfill-dict-level.js',
                'vocab-server/scripts/backfill_dict_level.py'
            )
            Write-Host "  -> No changed-file list; defaulting to full core backend & script set" -ForegroundColor Yellow
        }

        Write-Host "  -> Backing up database and service config" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "mkdir -p $RemoteApiRoot/private/books $remoteReleaseRoot/backend && chmod 700 $RemoteApiRoot/private $RemoteApiRoot/private/books && sudo mkdir -p /var/lib/super-agent && sudo chown ubuntu:ubuntu /var/lib/super-agent && if [ ! -f /var/lib/super-agent/vocab.db ] && [ -f $RemoteWebRoot/vocab.db ]; then cp $RemoteWebRoot/vocab.db /var/lib/super-agent/vocab.db; fi && sudo systemctl stop super-agent-vocab.service && trap 'sudo systemctl start super-agent-vocab.service' EXIT && cp /var/lib/super-agent/vocab.db $remoteReleaseRoot/vocab.db && cp -a $RemoteApiRoot/. $remoteReleaseRoot/backend/ && { sudo cp /etc/systemd/system/super-agent-vocab.service $remoteReleaseRoot/super-agent-vocab.service 2>/dev/null || true; } && sudo systemctl start super-agent-vocab.service && trap - EXIT"
        $backendTouched = $true
        Invoke-RemoteCommand "sudo test -r /etc/super-agent/vocab.env && sudo grep -q '^DIFY_BOOK_FRAMEWORK_API_KEY=.' /etc/super-agent/vocab.env && sudo grep -q '^DIFY_BOOK_FRAMEWORK_URL=.' /etc/super-agent/vocab.env && sudo grep -q '^DIFY_BOOK_LISTEN_API_KEY=.' /etc/super-agent/vocab.env && sudo grep -q '^DIFY_BOOK_LISTEN_URL=.' /etc/super-agent/vocab.env && sudo grep -q '^DIFY_BOOK_EXERCISE_API_KEY=.' /etc/super-agent/vocab.env && sudo grep -q '^DIFY_BOOK_EXERCISE_URL=.' /etc/super-agent/vocab.env && sudo grep -q '^DIFY_BOOK_ALLOWED_HOSTS=.' /etc/super-agent/vocab.env && command -v ebook-convert >/dev/null && ebook-convert --version && test `$(df --output=avail -B1 /var/lib/super-agent | tail -1) -ge 12884901888 && { if sudo grep -q '^BOOK_OCR_ENABLED=true$' /etc/super-agent/vocab.env; then sudo grep -q '^UMI_OCR_URL=.' /etc/super-agent/vocab.env && curl -fsS http://127.0.0.1:1224/ >/dev/null; else echo 'OCR capability disabled'; fi; }"
        
        Write-Host "  -> Packing changed backend files" -ForegroundColor DarkCyan
        $backendStage = Join-Path $env:TEMP "super-agent-backend-stage-$timestamp"
        $backendArchive = Join-Path $env:TEMP "backend-changes.tar.gz"
        Remove-Item $backendStage, $backendArchive -Recurse -Force -ErrorAction SilentlyContinue
        New-Item -ItemType Directory -Path $backendStage | Out-Null
        foreach ($file in $changedFiles) {
            if ($file -match "^vocab-server/") {
                $relativePath = $file -replace '^vocab-server/', ''
                $localFile = "$ProjectRoot\vocab-server\$relativePath".Replace('/', '\')
                if (Test-Path $localFile) {
                    $stagePath = Join-Path $backendStage $relativePath
                    $stageParent = Split-Path $stagePath -Parent
                    New-Item -ItemType Directory -Path $stageParent -Force | Out-Null
                    Copy-Item $localFile $stagePath -Recurse -Force
                }
            }
        }
        tar -czf $backendArchive -C $backendStage .
        if ($LASTEXITCODE -ne 0) { throw 'Backend archive creation failed' }
        Write-Host "  -> Uploading backend archive" -ForegroundColor DarkCyan
        Send-File $backendArchive "$remoteReleaseRoot/backend-changes.tar.gz"
        Invoke-RemoteCommand "rm -rf $remoteReleaseRoot/backend-stage && mkdir -p $remoteReleaseRoot/backend-stage && tar -xzf $remoteReleaseRoot/backend-changes.tar.gz -C $remoteReleaseRoot/backend-stage && cp -a $remoteReleaseRoot/backend-stage/. $RemoteApiRoot/"
        Remove-Item $backendStage, $backendArchive -Recurse -Force -ErrorAction SilentlyContinue

        Write-Host "  -> Preserving server-managed /etc/super-agent/vocab.env" -ForegroundColor DarkGreen

        $runFixOldVocab = $false
        $runBackfillLevel = $false
        foreach ($file in $changedFiles) {
            if ($file -match "vocab-server/scripts/fix_old_vocab.cjs") {
                $runFixOldVocab = $true
            }
            if ($file -match "vocab-server/scripts/backfill-dict-level.js" -or $file -match "vocab-server/scripts/backfill_dict_level.py") {
                $runBackfillLevel = $true
            }
        }

        if ($runFixOldVocab) {
            Write-Host "  -> Running database fix script: fix_old_vocab.cjs" -ForegroundColor DarkCyan
            Invoke-RemoteCommand "node $RemoteApiRoot/scripts/fix_old_vocab.cjs"
        }
        if ($runBackfillLevel) {
            Write-Host "  -> Running database level backfill: backfill-dict-level.js" -ForegroundColor DarkCyan
            Invoke-RemoteCommand "node $RemoteApiRoot/scripts/backfill-dict-level.js /var/lib/super-agent/vocab.db"
        }
        if ($changedFiles -match "vocab-server/(package.json|package-lock.json)") {
            Write-Host "  -> Installing locked backend dependencies" -ForegroundColor DarkCyan
            Invoke-RemoteCommand "cd $RemoteApiRoot && npm ci"
        }

        $edgeTtsInstall = "$ProjectRoot\scripts\install-edge-tts-server.sh"
        if (Test-Path $edgeTtsInstall -PathType Leaf) {
            Write-Host "  -> Ensuring edge-tts is installed on server" -ForegroundColor DarkCyan
            Send-File $edgeTtsInstall "/tmp/install-edge-tts-server.sh"
            Invoke-RemoteCommand "chmod +x /tmp/install-edge-tts-server.sh && bash /tmp/install-edge-tts-server.sh"
        }
        
        if ($changedFiles -match "super-agent-vocab.service") {
            Send-File "$ProjectRoot\super-agent-vocab.service" "/tmp/super-agent-vocab.service"
            Invoke-RemoteCommand "sudo install -m 0644 /tmp/super-agent-vocab.service /etc/systemd/system/super-agent-vocab.service && sudo systemctl daemon-reload"
            $serviceConfigTouched = $true
        }
 
        Write-Host "  -> Restarting vocab service" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo systemctl restart super-agent-vocab.service"

        Write-Host "  -> Waiting for service initialization & verifying health on remote" -ForegroundColor DarkCyan
        Start-Sleep -Seconds 2
        Invoke-RemoteCommand "healthy=0; for i in 1 2 3 4 5; do if curl -fsS http://127.0.0.1:3001/api/vocab/health >/dev/null 2>&1; then curl -sS http://127.0.0.1:3001/api/vocab/health; healthy=1; break; fi; sleep 1; done; [ `"`$healthy`" = 1 ] || exit 1"
        Invoke-RemoteCommand "node /var/www/super-agent/vocab-server/tests/oralChatStream.test.js && node /var/www/super-agent/vocab-server/tests/audioTranscriptionConcurrency.test.js && node /var/www/super-agent/vocab-server/tests/listenBackfillSla.test.js && node /var/www/super-agent/vocab-server/tests/dailyPackTodaySla.test.js && node /var/www/super-agent/vocab-server/tests/writeGovernanceStreamNoFallback.test.js && node /var/www/super-agent/vocab-server/tests/gameTheoryRoundStream.test.js"
        Write-Host "  -> Remote SLA Contract Tests 100% Passed!" -ForegroundColor Green

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
        Send-File "$ProjectRoot\app.liujingzhuwo.site" "/tmp/app.liujingzhuwo.site.candidate"
        Invoke-RemoteCommand "sudo mkdir -p /var/log/nginx && sudo cp /etc/nginx/sites-available/app.liujingzhuwo.site $remoteReleaseRoot/nginx.previous"
        $nginxConfigTouched = $true
        Invoke-RemoteCommand "sudo cp /tmp/app.liujingzhuwo.site.candidate /etc/nginx/sites-available/app.liujingzhuwo.site.candidate; sudo ln -sfn /etc/nginx/sites-available/app.liujingzhuwo.site.candidate /etc/nginx/sites-enabled/app.liujingzhuwo.site.candidate; sudo nginx -t; sudo mv /etc/nginx/sites-available/app.liujingzhuwo.site.candidate /etc/nginx/sites-available/app.liujingzhuwo.site; sudo ln -sfn /etc/nginx/sites-available/app.liujingzhuwo.site /etc/nginx/sites-enabled/app.liujingzhuwo.site; sudo rm -f /etc/nginx/sites-enabled/app.liujingzhuwo.site.candidate; sudo systemctl reload nginx"
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
    Invoke-RemoteCommand "sudo mkdir -p /var/log/nginx && sudo touch /var/log/nginx/error.log && sudo tail -n 20 /var/log/nginx/error.log"

    Write-Host ""
    Write-Host "Source control unchanged; commit and push remain manual." -ForegroundColor DarkGreen

    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host " 🎉 Smart Deploy Completed!" -ForegroundColor Green
    Write-Host " 🌐 URL: https://app.liujingzhuwo.site/" -ForegroundColor Green
    Write-Host " 💡 Please press Ctrl+Shift+R to force refresh." -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
}
catch {
    Write-Host "Deployment failed; starting rollback." -ForegroundColor Red
    $rollbackErrors = @()
    if ($nginxConfigTouched) { try { Invoke-RemoteCommand "if [ -f $remoteReleaseRoot/nginx.previous ]; then sudo cp $remoteReleaseRoot/nginx.previous /etc/nginx/sites-available/app.liujingzhuwo.site && sudo ln -sfn /etc/nginx/sites-available/app.liujingzhuwo.site /etc/nginx/sites-enabled/app.liujingzhuwo.site && sudo nginx -t && sudo systemctl reload nginx; fi" } catch { $rollbackErrors += $_.Exception.Message } }
    if ($frontendSwapped) { try { Invoke-RemoteCommand "if [ -d $remoteReleaseRoot/dist.previous ]; then rm -rf $RemoteWebRoot/dist && mv $remoteReleaseRoot/dist.previous $RemoteWebRoot/dist; fi" } catch { $rollbackErrors += $_.Exception.Message } }
    if ($serviceConfigTouched) { try { Invoke-RemoteCommand "if [ -f $remoteReleaseRoot/super-agent-vocab.service ]; then sudo cp $remoteReleaseRoot/super-agent-vocab.service /etc/systemd/system/super-agent-vocab.service && sudo systemctl daemon-reload; fi" } catch { $rollbackErrors += $_.Exception.Message } }
    if ($backendTouched) { try { Invoke-RemoteCommand "sudo systemctl stop super-agent-vocab.service; rm -rf $RemoteApiRoot.failed; mv $RemoteApiRoot $RemoteApiRoot.failed; cp -a $remoteReleaseRoot/backend $RemoteApiRoot; cp $remoteReleaseRoot/vocab.db /var/lib/super-agent/vocab.db; sudo systemctl restart super-agent-vocab.service" } catch { $rollbackErrors += $_.Exception.Message } }
    if ($rollbackErrors.Count) { throw "Deployment and rollback failed: $($rollbackErrors -join '; ')" }
    throw
}
finally {
    if ($UsePuTTY -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
