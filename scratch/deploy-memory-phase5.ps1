# ============================================================
# Memory System Phase 5 — 生产部署 + 全链路验证（手动执行）
# 覆盖：Phase 2 Recall / Phase 3 Cluster / Phase 1 L0-L1 / Phase 4 l3_vars
#
# ⚠️ 验证脚本 verify-memory-phase5.sh 只能在「生产服务器」上跑，不能在本机 WSL 跑 /var/www/...
# 本机验证请用：.\scratch\verify-memory-phase5-remote.ps1 -UseSystemSSH
#
# 用法（PowerShell，项目根目录）：
#   powershell -ExecutionPolicy Bypass -File .\scratch\deploy-memory-phase5.ps1 -UseSystemSSH
#   powershell -ExecutionPolicy Bypass -File .\scratch\verify-memory-phase5-remote.ps1 -UseSystemSSH
#   powershell -ExecutionPolicy Bypass -File .\scratch\deploy-memory-phase5.ps1 -SkipFrontend
#   powershell -ExecutionPolicy Bypass -File .\scratch\deploy-memory-phase5.ps1 -SkipVerify
#
# 或使用现有 deploy-smart（含 git push）：
#   powershell -ExecutionPolicy Bypass -File .\deploy-smart.ps1 -UseSystemSSH
# ============================================================

param(
    [switch]$UseSystemSSH,
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$SkipYml,
    [switch]$SkipVerify,
    [string]$SSHPassword,
    [string]$TestUserId = "deploy-memory-test"
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$HostKeyOptions = @('-hostkey', $HostKey)

Set-Location $ProjectRoot

Write-Host "========== Memory Phase 5 Deploy ==========" -ForegroundColor Cyan
Write-Host "Server: $ServerHost"
Write-Host ""

$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$UsePuTTY = ($null -ne $Pscp) -and ($null -ne $Plink) -and (-not $UseSystemSSH)

$PlainPassword = $null
$PasswordPtr = [IntPtr]::Zero
if ($UsePuTTY) {
    if ($SSHPassword) {
        $PlainPassword = $SSHPassword
    } else {
        $Password = Read-Host 'Enter SSH password (empty if using key/Pageant)' -AsSecureString
        if ($Password.Length -gt 0) {
            $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
            $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)
        }
    }
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
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed: $Command" }
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
    if ($LASTEXITCODE -ne 0) { throw "Upload failed: $Source -> $Destination" }
}

try {
    if (-not $SkipBackend) {
        Write-Host "--- Step 1: Backend (vocab-server) ---" -ForegroundColor Cyan
        $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
        Invoke-RemoteCommand "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak-$ts 2>/dev/null || true"
        Send-File "$ProjectRoot\vocab-server\server.js" "$RemoteApiRoot/server.js"

        $envFile = "$ProjectRoot\vocab-server\.env"
        if (Test-Path $envFile) {
            Write-Host "  Upload vocab-server/.env" -ForegroundColor DarkCyan
            Send-File $envFile "$RemoteApiRoot/.env"
        } else {
            Write-Host "  Skip .env (local not found — ensure DIFY_MEMORY_DREAMING_API_KEY on server)" -ForegroundColor Yellow
        }

        Write-Host "  Restart super-agent-vocab.service" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo systemctl restart super-agent-vocab.service && sleep 2 && sudo systemctl is-active super-agent-vocab.service"
    } else {
        Write-Host "--- Step 1: Skip Backend ---" -ForegroundColor DarkGray
    }

    if (-not $SkipFrontend) {
        Write-Host "--- Step 2: Frontend build + sync ---" -ForegroundColor Cyan
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/dist/assets $RemoteWebRoot/dist/images"
        Send-File "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
        if (Test-Path "$ProjectRoot\dist\assets") { Send-File "$ProjectRoot\dist\assets" "$RemoteWebRoot/dist/" }
        if (Test-Path "$ProjectRoot\dist\images") { Send-File "$ProjectRoot\dist\images" "$RemoteWebRoot/dist/" }
        Invoke-RemoteCommand "sudo nginx -t && sudo systemctl reload nginx"
    } else {
        Write-Host "--- Step 2: Skip Frontend ---" -ForegroundColor DarkGray
    }

    if (-not $SkipYml) {
        Write-Host "--- Step 3: Sync yml + verify scripts ---" -ForegroundColor Cyan
        Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/yml $RemoteWebRoot/scratch"
        Send-File "$ProjectRoot\yml\memory_dreaming_workflow.yml" "$RemoteWebRoot/yml/"
        Send-File "$ProjectRoot\yml\mychat_memory_kb.yml" "$RemoteWebRoot/yml/"
        Send-File "$ProjectRoot\scratch\verify-memory-phase5.sh" "$RemoteWebRoot/scratch/"
        Send-File "$ProjectRoot\scratch\test-memory-dreaming.sh" "$RemoteWebRoot/scratch/"
        Send-File "$ProjectRoot\scratch\test-mychat-memory-e2e.sh" "$RemoteWebRoot/scratch/"
        Invoke-RemoteCommand "chmod +x $RemoteWebRoot/scratch/verify-memory-phase5.sh $RemoteWebRoot/scratch/test-memory-dreaming.sh $RemoteWebRoot/scratch/test-mychat-memory-e2e.sh"
        Write-Host "  yml synced to $RemoteWebRoot/yml (Dify 需手动导入 DSL)" -ForegroundColor Yellow
    } else {
        Write-Host "--- Step 3: Skip Yml ---" -ForegroundColor DarkGray
    }

    Write-Host "--- Step 4: Service logs ---" -ForegroundColor Cyan
    Invoke-RemoteCommand "sudo journalctl -u super-agent-vocab.service -n 15 --no-pager | grep -E 'Memory Dreaming|cluster enabled|running on port|error' || sudo journalctl -u super-agent-vocab.service -n 10 --no-pager"

    if (-not $SkipVerify) {
        Write-Host "--- Step 5: Remote verification ---" -ForegroundColor Cyan
        Invoke-RemoteCommand "bash $RemoteWebRoot/scratch/verify-memory-phase5.sh $TestUserId"
    } else {
        Write-Host "--- Step 5: Skip Verify ---" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host " Memory Phase 5 deploy finished" -ForegroundColor Green
    Write-Host " Site: https://app.liujingzhuwo.site/" -ForegroundColor Green
    Write-Host " Manual verify: ssh $ServerHost 'bash $RemoteWebRoot/scratch/verify-memory-phase5.sh'" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Dify 手动步骤（部署后必做）：" -ForegroundColor Yellow
    Write-Host "  1. 导入 yml/memory_dreaming_workflow.yml → 确认 API Key app-KlXuWwhQmsssv5sjjzN5b7BR"
    Write-Host "  2. 导入 yml/mychat_memory_kb.yml → 确认 L1摘要回写vocab-server 节点存在"
    Write-Host "  3. 发布两个应用后，在服务器执行 verify-memory-phase5.sh"
}
finally {
    if ($UsePuTTY -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
