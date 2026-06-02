# ============================================================
# Super-Agent 增量部署脚本
# 修改范围：后端 vocab-server/server.js（每日配额控制）
# 前端：dist/index.html（已包含前端所有变更）
# ============================================================
# 使用方式：在 Windows PowerShell 中直接运行（仅需输入一次服务器密码）
#   .\deploy-daily-quota.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfF'
$HostKeyOptions = @('-hostkey', $HostKey)

$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source

if (-not $Pscp -or -not $Plink) {
    Write-Host '错误：未找到 pscp.exe / plink.exe。请先安装 PuTTY 并将安装路径加入 PATH。' -ForegroundColor Red
    Write-Host 'PuTTY 下载：https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html' -ForegroundColor Yellow
    throw 'PuTTY not found.'
}

$Password = Read-Host '请输入服务器密码' -AsSecureString
$PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)

function Invoke-RemoteCommand {
    param([string]$Command)
    & $Plink @HostKeyOptions -pw $PlainPassword -batch $ServerHost $Command
    if ($LASTEXITCODE -ne 0) {
        throw "远程命令执行失败: $Command"
    }
}

function Send-File {
    param([string]$Source, [string]$Destination)
    & $Pscp @HostKeyOptions -pw $PlainPassword -batch $Source $Destination
    if ($LASTEXITCODE -ne 0) {
        throw "文件上传失败: $Source -> $Destination"
    }
}

try {
    Set-Location $ProjectRoot

    Write-Host ''
    Write-Host '==========  Step 1: 构建前端 ==========' -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

    Write-Host ''
    Write-Host '==========  Step 2: 上传前端静态产物 ==========' -ForegroundColor Cyan
    # 上传 index.html（vite-plugin-singlefile 单文件产物）
    Send-File "$ProjectRoot\dist\index.html" "${ServerHost}:$RemoteWebRoot/dist/index.html"

    # 同时上传 dist 目录下其他文件（assets 等）
    Send-File "$ProjectRoot\dist\*" "${ServerHost}:$RemoteWebRoot/dist/"

    Write-Host ''
    Write-Host '==========  Step 3: 备份旧版 server.js ==========' -ForegroundColor Cyan
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    Invoke-RemoteCommand "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak-$timestamp"
    Write-Host "已备份为 server.js.bak-$timestamp"

    Write-Host ''
    Write-Host '==========  Step 4: 上传后端 vocab-server ==========' -ForegroundColor Cyan
    # 上传 server.js（本次核心修改）
    Send-File "$ProjectRoot\vocab-server\server.js" "${ServerHost}:$RemoteApiRoot/server.js"
    Write-Host 'server.js 已上传'

    # 上传 package.json（如果已更新）
    Send-File "$ProjectRoot\vocab-server\package.json" "${ServerHost}:$RemoteApiRoot/package.json"

    # 上传 systemd service 文件
    Send-File "$ProjectRoot\scratch\super-agent-vocab.service" "${ServerHost}:/tmp/super-agent-vocab.service"

    Write-Host ''
    Write-Host '==========  Step 5: 服务器侧操作 ==========' -ForegroundColor Cyan
    Write-Host '  [5.1] 检查 Nginx 配置...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand 'sudo nginx -t'

    Write-Host '  [5.2] 重载 Nginx...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand 'sudo systemctl reload nginx'

    Write-Host '  [5.3] 安装后端依赖（如 package.json 变更）...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand "cd $RemoteApiRoot; npm install"

    Write-Host '  [5.4] 更新并重启后端服务...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand 'sudo cp /tmp/super-agent-vocab.service /etc/systemd/system/'
    Invoke-RemoteCommand 'sudo systemctl daemon-reload'
    Invoke-RemoteCommand 'sudo systemctl restart super-agent-vocab.service'

    Write-Host ''
    Write-Host '==========  Step 6: 健康检查 ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand 'sudo systemctl status super-agent-vocab.service --no-pager'
    Invoke-RemoteCommand 'curl -s http://127.0.0.1:3001/api/vocab/stats'
    Invoke-RemoteCommand 'curl -s http://127.0.0.1:3001/api/daily-quota/status?userId=default-user'

    Write-Host ''
    Write-Host '====================================================' -ForegroundColor Green
    Write-Host '  部署完成！请在浏览器访问 https://app.liujingzhuwo.site/' -ForegroundColor Green
    Write-Host '  并按 Ctrl+Shift+R 强制刷新。' -ForegroundColor Green
    Write-Host '====================================================' -ForegroundColor Green
    Write-Host ''
}
finally {
    if ($PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
