# 从 Windows 通过 SSH 在生产服务器上执行全链路验证
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\scratch\verify-memory-phase5-remote.ps1
#   powershell -ExecutionPolicy Bypass -File .\scratch\verify-memory-phase5-remote.ps1 -UseSystemSSH
#   powershell -ExecutionPolicy Bypass -File .\scratch\verify-memory-phase5-remote.ps1 -TestUserId "your-user-id"

param(
    [switch]$UseSystemSSH,
    [string]$SSHPassword,
    [string]$TestUserId = "deploy-memory-test"
)

$ErrorActionPreference = 'Stop'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteScript = '/var/www/super-agent/scratch/verify-memory-phase5.sh'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$HostKeyOptions = @('-hostkey', $HostKey)

Write-Host "========== Remote Memory Phase 5 Verify ==========" -ForegroundColor Cyan
Write-Host "Target: $ServerHost"
Write-Host "NOTE: 此脚本在远程 Linux 服务器执行，不要在本地 WSL 跑 /var/www/... 路径"
Write-Host ""

$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source
$UsePuTTY = ($null -ne $Plink) -and (-not $UseSystemSSH)

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

$remoteCmd = "bash $RemoteScript $TestUserId"
try {
    if ($UsePuTTY) {
        if ($PlainPassword) {
            & $Plink @HostKeyOptions -pw $PlainPassword -batch $ServerHost $remoteCmd
        } else {
            & $Plink @HostKeyOptions -batch $ServerHost $remoteCmd
        }
    } else {
        ssh $ServerHost $remoteCmd
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    if ($UsePuTTY -and $PasswordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
    }
}
