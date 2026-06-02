$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent/dist' # 线上前端 Nginx 托管目录

# 检测本地是否安装了 PuTTY 工具链
$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source

if (-not $Pscp -or -not $Plink) {
  # 回退策略：使用系统自带的 native scp 和 ssh
  Write-Host 'pscp.exe/plink.exe 未找到，使用原生 OpenSSH (scp/ssh) 进行部署...' -ForegroundColor Yellow
  try {
    Set-Location $ProjectRoot

    Write-Host '1. 安装依赖...' -ForegroundColor Cyan
    pnpm install

    Write-Host '2. 编译打包前端产物...' -ForegroundColor Cyan
    pnpm build

    Write-Host '3. 上传静态资源到服务器...' -ForegroundColor Cyan
    scp -r .\dist\* "${ServerHost}:${RemoteWebRoot}/"

    Write-Host '4. 远程重载 Nginx 服务...' -ForegroundColor Cyan
    ssh $ServerHost "sudo nginx -t && sudo systemctl reload nginx"

    Write-Host '部署成功 (OpenSSH 模式)！' -ForegroundColor Green
  } catch {
    Write-Error $_
  }
  exit
}

# PuTTY 模式：仅需输入一次密码
$Password = Read-Host 'Enter server password' -AsSecureString
$PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)

function Invoke-RemoteCommand {
  param([string]$Command)
  & $Plink -ssh -pw $PlainPassword -batch $ServerHost $Command
  if ($LASTEXITCODE -ne 0) { throw "远程指令执行失败: $Command" }
}

function Send-Files {
  param([string]$Source, [string]$Destination)
  & $Pscp -r -pw $PlainPassword -batch $Source $Destination
  if ($LASTEXITCODE -ne 0) { throw "上传文件失败: $Source -> $Destination" }
}

try {
  Set-Location $ProjectRoot
  
  Write-Host '1. 安装本地依赖...' -ForegroundColor Cyan
  pnpm install

  Write-Host '2. 编译打包前端产物...' -ForegroundColor Cyan
  pnpm build

  Write-Host '3. 上传前端产物中...' -ForegroundColor Cyan
  # 覆盖静态资源
  Send-Files "$ProjectRoot\dist\*" "${ServerHost}:${RemoteWebRoot}/"

  Write-Host '4. 重载 Nginx 配置...' -ForegroundColor Cyan
  Invoke-RemoteCommand 'sudo nginx -t && sudo systemctl reload nginx'

  Write-Host '部署成功 (PuTTY 免重复输密模式)！' -ForegroundColor Green
}
finally {
  if ($PasswordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
  }
}
