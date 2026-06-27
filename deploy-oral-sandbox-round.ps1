# ============================================================
# 本轮增量部署：多角色口语沙盘 (OralWarRoom + difyAPI + yml v8)
# 手动执行，不含 git commit/push
# ============================================================
# 用法：
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-oral-sandbox-round.ps1"
# 使用系统 SSH（非 PuTTY）：
#   powershell -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\deploy-oral-sandbox-round.ps1" -UseSystemSSH
# ============================================================

param(
    [switch]$UseSystemSSH,
    [string]$SSHPassword
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$HostKeyOptions = if ($HostKey) { @("-hostkey", $HostKey) } else { @() }

Set-Location $ProjectRoot

Write-Host "========== 本轮变更文件 ==========" -ForegroundColor Cyan
Write-Host "  src/components/modules/OralWarRoom.tsx"
Write-Host "  src/services/difyAPI.ts"
Write-Host "  yml/English_Oral_Sandbox (8).yml"
Write-Host ""

# SSH/SCP 工具选择
$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$UsePuTTY = ($null -ne $Pscp) -and ($null -ne $Plink) -and (-not $UseSystemSSH)

if ($UsePuTTY) {
    Write-Host "使用 PuTTY (pscp/plink)" -ForegroundColor Green
    $PasswordPtr = [IntPtr]::Zero
    if ($SSHPassword) {
        $PlainPassword = $SSHPassword
    } else {
        $Password = Read-Host 'Enter SSH password' -AsSecureString
        $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
        $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)
    }
} else {
    Write-Host "使用系统 ssh/scp" -ForegroundColor Yellow
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
    if ($LASTEXITCODE -ne 0) { throw "远程命令失败: $Command" }
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
    if ($LASTEXITCODE -ne 0) { throw "上传失败: $Source -> $Destination" }
}

try {
    # ── Step 1: 前端构建 ──
    Write-Host "========== Step 1: 前端构建 ==========" -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install 失败' }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'pnpm build 失败' }

    # ── Step 2: 上传 dist ──
    Write-Host "========== Step 2: 上传前端 dist ==========" -ForegroundColor Cyan
    Invoke-RemoteCommand "mkdir -p $RemoteWebRoot/dist/images/backgrounds $RemoteWebRoot/dist/assets $RemoteWebRoot/yml"
    Send-File "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
    if (Test-Path "$ProjectRoot\dist\assets") {
        Send-File "$ProjectRoot\dist\assets" "$RemoteWebRoot/dist/"
    }
    if (Test-Path "$ProjectRoot\dist\images") {
        Send-File "$ProjectRoot\dist\images" "$RemoteWebRoot/dist/"
    }

    # ── Step 3: 上传 yml v8（服务器备份，Dify 已在控制台导入） ──
    Write-Host "========== Step 3: 上传 Dify 工作流 yml ==========" -ForegroundColor Cyan
    $ymlFile = "$ProjectRoot\yml\English_Oral_Sandbox (8).yml"
    if (-not (Test-Path $ymlFile)) { throw "找不到 $ymlFile" }
    Send-File $ymlFile "$RemoteWebRoot/yml/English_Oral_Sandbox_v8.yml"

    # ── Step 4: 重载 Nginx ──
    Write-Host "========== Step 4: 重载 Nginx ==========" -ForegroundColor Cyan
    Invoke-RemoteCommand "sudo nginx -t && sudo systemctl reload nginx"

    # ── Step 5: 健康检查 ──
    Write-Host "========== Step 5: 服务状态 ==========" -ForegroundColor Cyan
    Invoke-RemoteCommand "curl -s http://127.0.0.1:3001/api/vocab/health || true"
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host " 部署完成！" -ForegroundColor Green
    Write-Host " 前端: https://app.liujingzhuwo.site/" -ForegroundColor Green
    Write-Host " yml  : $RemoteWebRoot/yml/English_Oral_Sandbox_v8.yml" -ForegroundColor Green
    Write-Host " 请 Ctrl+Shift+R 强制刷新浏览器" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "注意: Dify v8 工作流需在 Dify 控制台手动发布；" -ForegroundColor Yellow
    Write-Host "      前端 VITE_DIFY_ORAL_API_KEY 需指向已发布应用的 API Key。" -ForegroundColor Yellow
}
finally {
    if ($UsePuTTY -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
