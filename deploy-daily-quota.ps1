# ============================================================
# Super-Agent Incremental Deployment Script
# Target: Backend vocab-server/server.js
# Frontend: dist/index.html (already contains all frontend changes)
# ============================================================
# Usage: Run directly in Windows PowerShell
#   .\deploy-daily-quota.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfF'
$HostKeyOptions = @()

$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source

if (-not $Pscp -or -not $Plink) {
    Write-Host 'Error: pscp.exe / plink.exe not found. Please install PuTTY and add it to PATH.' -ForegroundColor Red
    Write-Host 'Download PuTTY: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html' -ForegroundColor Yellow
    throw 'PuTTY not found.'
}

$Password = Read-Host 'Enter server password' -AsSecureString
$PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)

function Invoke-RemoteCommand {
    param([string]$Command)
    & $Plink @HostKeyOptions -pw $PlainPassword -batch $ServerHost $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command execution failed: $Command"
    }
}

function Send-File {
    param([string]$Source, [string]$Destination)
    & $Pscp @HostKeyOptions -pw $PlainPassword -batch $Source $Destination
    if ($LASTEXITCODE -ne 0) {
        throw "File upload failed: $Source -> $Destination"
    }
}

try {
    Set-Location $ProjectRoot

    Write-Host ''
    Write-Host '==========  Step 1: Building Frontend ==========' -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

    Write-Host ''
    Write-Host '==========  Step 2: Uploading Frontend Static Assets ==========' -ForegroundColor Cyan
    # Upload index.html
    Send-File "$ProjectRoot\dist\index.html" "${ServerHost}:$RemoteWebRoot/dist/index.html"

    # Upload other assets
    Send-File "$ProjectRoot\dist\*" "${ServerHost}:$RemoteWebRoot/dist/"

    Write-Host ''
    Write-Host '==========  Step 3: Backing up old server.js ==========' -ForegroundColor Cyan
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    Invoke-RemoteCommand "cp $RemoteApiRoot/server.js $RemoteApiRoot/server.js.bak-$timestamp"
    Write-Host "Backed up to server.js.bak-$timestamp"

    Write-Host ''
    Write-Host '==========  Step 4: Uploading Backend vocab-server ==========' -ForegroundColor Cyan
    Send-File "$ProjectRoot\vocab-server\server.js" "${ServerHost}:$RemoteApiRoot/server.js"
    Write-Host 'server.js uploaded'

    Send-File "$ProjectRoot\vocab-server\package.json" "${ServerHost}:$RemoteApiRoot/package.json"

    Send-File "$ProjectRoot\scratch\super-agent-vocab.service" "${ServerHost}:/tmp/super-agent-vocab.service"

    Write-Host ''
    Write-Host '==========  Step 5: Server Operations ==========' -ForegroundColor Cyan
    Write-Host '  [5.1] Uploading and applying Nginx configuration...' -ForegroundColor DarkCyan
    Send-File "$ProjectRoot\app.liujingzhuwo.site" "${ServerHost}:/tmp/app.liujingzhuwo.site"
    Invoke-RemoteCommand "sudo cp /tmp/app.liujingzhuwo.site /etc/nginx/sites-available/app.liujingzhuwo.site && sudo cp /tmp/app.liujingzhuwo.site /etc/nginx/sites-enabled/app.liujingzhuwo.site"

    Write-Host '  [5.2] Checking Nginx configuration...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand 'sudo nginx -t'

    Write-Host '  [5.3] Reloading Nginx...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand 'sudo systemctl reload nginx'

    Write-Host '  [5.4] Installing backend dependencies...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand "cd $RemoteApiRoot; npm install"

    Write-Host '  [5.5] Updating and restarting backend service...' -ForegroundColor DarkCyan
    Invoke-RemoteCommand 'sudo cp /tmp/super-agent-vocab.service /etc/systemd/system/'
    Invoke-RemoteCommand 'sudo systemctl daemon-reload'
    Invoke-RemoteCommand 'sudo systemctl restart super-agent-vocab.service'

    Write-Host ''
    Write-Host '==========  Step 6: Health Check ==========' -ForegroundColor Cyan
    Invoke-RemoteCommand 'sudo systemctl status super-agent-vocab.service --no-pager'
    Invoke-RemoteCommand 'curl -s http://127.0.0.1:3001/api/vocab/stats'
    Invoke-RemoteCommand 'curl -s http://127.0.0.1:3001/api/daily-quota/status?userId=default-user'

    Write-Host ''
    Write-Host '====================================================' -ForegroundColor Green
    Write-Host '  Deployment complete! Please visit https://app.liujingzhuwo.site/' -ForegroundColor Green
    Write-Host '  and press Ctrl+Shift+R to force refresh.' -ForegroundColor Green
    Write-Host '====================================================' -ForegroundColor Green
    Write-Host ''
}
finally {
    if ($PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
