# 仅部署 TTS 相关后端 server.js（不依赖 git 变更检测）
$ErrorActionPreference = 'Stop'
$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfF'
$HostKeyOptions = @('-hostkey', $HostKey)
$LocalServerJs = Join-Path $ProjectRoot 'vocab-server\server.js'
$InstallScript = Join-Path $ProjectRoot 'scripts\install-edge-tts-server.sh'

$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$UsePuTTY = ($null -ne $Pscp) -and ($null -ne $Plink)

if (-not (Test-Path $LocalServerJs)) {
    throw "找不到 $LocalServerJs"
}

if ($UsePuTTY) {
    $Password = Read-Host 'Enter SSH password' -AsSecureString
    $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)
}

function Invoke-RemoteCommand {
    param([string]$Command)
    if ($UsePuTTY) {
        & $Plink @HostKeyOptions -pw $PlainPassword -batch $ServerHost $Command
    } else {
        ssh $ServerHost $Command
    }
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed: $Command" }
}

function Send-RemoteFile {
    param([string]$Source, [string]$Destination)
    if ($UsePuTTY) {
        & $Pscp -r @HostKeyOptions -pw $PlainPassword -batch $Source "${ServerHost}:$Destination"
    } else {
        scp $Source "${ServerHost}:$Destination"
    }
    if ($LASTEXITCODE -ne 0) { throw "Upload failed: $Source -> $Destination" }
}

try {
    Write-Host "安装 edge-tts（若未安装）..." -ForegroundColor Cyan
    Send-RemoteFile $InstallScript '/tmp/install-edge-tts-server.sh'
    Invoke-RemoteCommand 'chmod +x /tmp/install-edge-tts-server.sh && bash /tmp/install-edge-tts-server.sh'

    Write-Host "上传 server.js -> ${ServerHost}:${RemoteApiRoot}/server.js" -ForegroundColor Cyan
    Send-RemoteFile $LocalServerJs "${RemoteApiRoot}/server.js"

    Write-Host "重启 super-agent-vocab.service ..." -ForegroundColor Cyan
    Invoke-RemoteCommand 'sudo systemctl restart super-agent-vocab.service && sleep 2 && sudo systemctl is-active super-agent-vocab.service'

    Write-Host "本机验证 TTS ..." -ForegroundColor Cyan
    curl.exe -s -X POST "https://app.liujingzhuwo.site/api/tts/speech" -H "Content-Type: application/json" -d "{\"input\":\"Hello test\",\"model\":\"edge-tts/en-ZA-LukeNeural\"}"

    Write-Host ""
    Write-Host "完成。若仍失败，请检查: journalctl -u super-agent-vocab.service -n 30" -ForegroundColor Green
}
finally {
    if ($UsePuTTY -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
