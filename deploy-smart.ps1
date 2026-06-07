# ============================================================
# Super-Agent 智能增量部署脚本 (Smart Deploy)
# 基于 Git 变更检测，自动决策并执行最经济的部署策略
# ============================================================

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfF'
$HostKeyOptions = @('-hostkey', $HostKey)

Set-Location $ProjectRoot

# 1. 自动检测代码变更 (基于 git 状态)
Write-Host "========== Step 1: 扫描工作区变更 ==========" -ForegroundColor Cyan
$gitStatus = git status --porcelain
$changedFiles = $gitStatus | ForEach-Object { $_ -replace '^...|\s+$', '' }

$needFrontendDeploy = $false
$needBackendDeploy = $false

if ($changedFiles.Count -eq 0) {
    Write-Host "当前工作区没有未提交的变更。正在检查上一次 commit 的变更..." -ForegroundColor Yellow
    $changedFiles = git diff --name-only HEAD~1 HEAD
}

foreach ($file in $changedFiles) {
    if ($file -match "^src/" -or $file -match "^public/" -or $file -match "index\.html$" -or $file -match "vite\.config\.ts$" -or $file -match "tsconfig\.json$") {
        $needFrontendDeploy = $true
    }
    if ($file -match "^vocab-server/") {
        $needBackendDeploy = $true
    }
    # Package.json 根目录如果改变，保险起见前后端都更
    if ($file -match "^package\.json$") {
        $needFrontendDeploy = $true
        $needBackendDeploy = $true
    }
}

if (-not $needFrontendDeploy -and -not $needBackendDeploy) {
    Write-Host "未检测到影响前后端核心的明显变更，将强制执行全量部署！" -ForegroundColor Magenta
    $needFrontendDeploy = $true
    $needBackendDeploy = $true
}

Write-Host "[分析结果]" -ForegroundColor DarkCyan
Write-Host "是否需要构建并部署前端: $needFrontendDeploy"
Write-Host "是否需要同步并重启后端: $needBackendDeploy"
Write-Host ""

# 2. 准备 SSH/SCP 工具
$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$UsePuTTY = ($Pscp -and $Plink)

if ($UsePuTTY) {
    Write-Host "检测到 PuTTY 工具链，启用免密极速模式。" -ForegroundColor Green
    $Password = Read-Host '请输入服务器密码' -AsSecureString
    $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)
} else {
    Write-Host "未检测到 PuTTY (pscp/plink)，使用系统自带 scp/ssh，过程中可能需要您输入多次密码。" -ForegroundColor Yellow
}

function Invoke-RemoteCommand {
    param([string]$Command)
    if ($UsePuTTY) {
        & $Plink @HostKeyOptions -pw $PlainPassword -batch $ServerHost $Command
    } else {
        ssh $ServerHost $Command
    }
    if ($LASTEXITCODE -ne 0) { throw "远程命令执行失败: $Command" }
}

function Send-File {
    param([string]$Source, [string]$Destination)
    if ($UsePuTTY) {
        & $Pscp -r @HostKeyOptions -pw $PlainPassword -batch $Source $Destination
    } else {
        scp -r $Source "${ServerHost}:$Destination"
    }
    if ($LASTEXITCODE -ne 0) { throw "文件上传失败: $Source -> $Destination" }
}

try {
    # 3. 执行前端部署
    if ($needFrontendDeploy) {
        Write-Host "========== Step 2: 前端构建与同步 ==========" -ForegroundColor Cyan
        Write-Host "  -> pnpm build" -ForegroundColor DarkCyan
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }

        Write-Host "  -> 正在上传前端静态产物" -ForegroundColor DarkCyan
        Send-File "$ProjectRoot\dist\index.html" "$RemoteWebRoot/dist/"
        Send-File "$ProjectRoot\dist\*" "$RemoteWebRoot/dist/"
        
        Write-Host "  -> Nginx Reload" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo nginx -t && sudo systemctl reload nginx"
    } else {
        Write-Host "========== Step 2: 忽略前端 ==========" -ForegroundColor DarkGray
        Write-Host "检测到前端无更改，跳过构建与同步。" -ForegroundColor DarkGray
    }

    # 4. 执行后端部署
    if ($needBackendDeploy) {
        Write-Host ""
        Write-Host "========== Step 3: 后端同步与重启 ==========" -ForegroundColor Cyan
        
        Write-Host "  -> 备份远程 server.js" -ForegroundColor DarkCyan
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Invoke-RemoteCommand "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak-$timestamp"
        
        Write-Host "  -> 上传变更的后端文件" -ForegroundColor DarkCyan
        # 针对本次变更列表中的后端文件进行上传（智能精准）
        foreach ($file in $changedFiles) {
            if ($file -match "^vocab-server/") {
                $relativePath = $file -replace '^vocab-server/', ''
                # 兼容 Windows 路径反斜杠
                $localFile = "$ProjectRoot\vocab-server\$relativePath".Replace('/', '\')
                if (Test-Path $localFile -PathType Leaf) {
                    Write-Host "     正在上传: $relativePath"
                    # 这里简化为直接把变动文件丢到 remote vocab-server 里
                    Send-File $localFile "$RemoteApiRoot/$relativePath"
                }
            }
        }
        # 为了防错，如果改了 package.json 就重新上传它并 install
        if ($changedFiles -match "vocab-server/package.json") {
            Write-Host "  -> 安装后端依赖" -ForegroundColor DarkCyan
            Invoke-RemoteCommand "cd $RemoteApiRoot && npm install"
        }
        
        # 始终同步一下 service 文件以防它也被改了
        if ($changedFiles -match "super-agent-vocab.service") {
            Send-File "$ProjectRoot\scratch\super-agent-vocab.service" "/tmp/super-agent-vocab.service"
            Invoke-RemoteCommand "sudo cp /tmp/super-agent-vocab.service /etc/systemd/system/ && sudo systemctl daemon-reload"
        }

        Write-Host "  -> 重启 Node API 服务" -ForegroundColor DarkCyan
        Invoke-RemoteCommand "sudo systemctl restart super-agent-vocab.service"
        Invoke-RemoteCommand "sudo systemctl status super-agent-vocab.service --no-pager"
    } else {
        Write-Host ""
        Write-Host "========== Step 3: 忽略后端 ==========" -ForegroundColor DarkGray
        Write-Host "检测到后端无更改，跳过同步与重启。" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host " 🎉 智能部署完成！" -ForegroundColor Green
    Write-Host " 🌐 访问地址: https://app.liujingzhuwo.site/" -ForegroundColor Green
    Write-Host " 💡 请在浏览器按 Ctrl+Shift+R 强制刷新页面" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
}
finally {
    if ($UsePuTTY -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
