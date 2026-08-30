# 一键配置 YouTube 下载前提（Windows）
# 用法：右键「一键配置YouTube.bat」→ 以管理员身份运行（一般不需要管理员）
#       或 PowerShell: .\setup-youtube-oneclick.ps1

param(
  [ValidateSet('full', 'tunnel', 'cookies')]
  [string]$Mode = 'full',
  [int]$LocalProxyPort = 0,
  [string]$SiteUrl = 'https://app.liujingzhuwo.site',
  [string]$SSHPassword = '',
  [string]$ConfigPath = "$env:USERPROFILE\.super-agent\youtube-setup.json"
)

$ErrorActionPreference = 'Stop'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteProxyPort = 17897
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptRoot '..\..') -ErrorAction SilentlyContinue
$ExportPy = Join-Path $ScriptRoot 'export-chrome-cookies-cdp.py'
if (-not (Test-Path $ExportPy)) {
  $ExportPy = Join-Path $RepoRoot 'vocab-server\scripts\export-chrome-cookies-cdp.py'
}
$CookiesOut = Join-Path $ScriptRoot 'youtube.cookies.txt'

function Write-Step([string]$Msg) {
  Write-Host "`n==> $Msg" -ForegroundColor Cyan
}

function Load-Config {
  if (Test-Path $ConfigPath) {
    return Get-Content $ConfigPath -Raw | ConvertFrom-Json
  }
  return $null
}

function Save-Config($cfg) {
  $dir = Split-Path $ConfigPath -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $cfg | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8
}

function Ensure-Config {
  $cfg = Load-Config
  if ($cfg) {
    if ($LocalProxyPort -eq 0 -and $cfg.localProxyPort) { $script:LocalProxyPort = [int]$cfg.localProxyPort }
    if (-not $SSHPassword -and $cfg.sshPassword) { $script:SSHPassword = [string]$cfg.sshPassword }
    if ($cfg.siteUrl) { $script:SiteUrl = [string]$cfg.siteUrl }
  }
  if ($LocalProxyPort -eq 0) { $script:LocalProxyPort = 7897 }
  if (-not $SSHPassword) {
    Write-Host '首次使用需要输入服务器 SSH 密码（仅保存在本机配置文件中）' -ForegroundColor Yellow
    $secure = Read-Host 'SSH 密码' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $script:SSHPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
  Save-Config @{
    localProxyPort = $LocalProxyPort
    sshPassword    = $SSHPassword
    siteUrl        = $SiteUrl
  }
}

function Find-Plink {
  $candidates = @(
    'plink',
    "$env:ProgramFiles\PuTTY\plink.exe",
    "$env:ProgramFiles(x86)\PuTTY\plink.exe"
  )
  foreach ($c in $candidates) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { return (Get-Command $c).Source }
    if (Test-Path $c) { return $c }
  }
  Write-Step '未找到 plink，正在安装 PuTTY...'
  winget install -e --id PuTTY.PuTTY --accept-package-agreements --accept-source-agreements | Out-Null
  if (Test-Path "$env:ProgramFiles\PuTTY\plink.exe") { return "$env:ProgramFiles\PuTTY\plink.exe" }
  throw '未找到 plink，请手动安装 PuTTY 后重试'
}

function Test-LocalProxy {
  Write-Step "检测本机代理 127.0.0.1:$LocalProxyPort"
  $ports = @($LocalProxyPort, 7897, 7890, 10808) | Select-Object -Unique
  foreach ($p in $ports) {
    if (Test-NetConnection -ComputerName 127.0.0.1 -Port $p -WarningAction SilentlyContinue | Where-Object { $_.TcpTestSucceeded }) {
      $script:LocalProxyPort = $p
      Write-Host "  本机代理端口: $p" -ForegroundColor Green
      return
    }
  }
  throw "未检测到本机代理。请先打开 Clash / Clash Verge，并确认 HTTP 代理已开启（常见端口 7897）"
}

function Start-Tunnel([string]$Plink) {
  Write-Step '启动反向隧道（后台最小化窗口，请保持运行）'
  $existing = Get-Process plink -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host '  检测到 plink 已在运行，跳过重复启动' -ForegroundColor Yellow
    return
  }
  $args = @(
    '-hostkey', $HostKey,
    '-pw', $SSHPassword,
    '-N',
    '-R', "${RemoteProxyPort}:127.0.0.1:${LocalProxyPort}",
    $ServerHost
  )
  Start-Process -FilePath $Plink -ArgumentList $args -WindowStyle Minimized | Out-Null
  Start-Sleep -Seconds 3
  Write-Host '  隧道已启动' -ForegroundColor Green
}

function Export-Cookies {
  Write-Step '从 Chrome 导出 YouTube 登录 cookies（会自动短暂打开 Chrome）'
  if (-not (Test-Path $ExportPy)) { throw "找不到导出脚本: $ExportPy`n请确保在项目目录内运行，或从网站重新下载一键配置包" }
  $python = (Get-Command python -ErrorAction SilentlyContinue)?.Source
  if (-not $python) { throw '未找到 Python，请安装 Python 3 后重试' }
  $env:OUT = $CookiesOut
  & $python $ExportPy
  if (-not (Test-Path $CookiesOut)) { throw 'cookies 导出失败' }
  $hasLogin = Select-String -Path $CookiesOut -Pattern "`tLOGIN_INFO`t" -Quiet
  if (-not $hasLogin) {
    throw '导出的 cookies 缺少 LOGIN_INFO。请先在 Chrome 登录 YouTube 后重试'
  }
  Write-Host "  已导出: $CookiesOut" -ForegroundColor Green
}

function Upload-Config {
  Write-Step '上传配置到服务器'
  $proxy = "http://127.0.0.1:$RemoteProxyPort"
  $form = @{
    proxy   = $proxy
    cookies = Get-Item -Path $CookiesOut
  }
  $uri = "$SiteUrl/api/materials/youtube-config"
  $resp = Invoke-RestMethod -Uri $uri -Method Post -Form $form
  if (-not $resp.success) { throw '服务器配置失败' }
  Write-Host "  代理: $proxy" -ForegroundColor Green
  Write-Host '  cookies 已上传' -ForegroundColor Green
  return $resp
}

function Wait-Ready {
  Write-Step '等待服务器检测就绪'
  for ($i = 0; $i -lt 12; $i++) {
    try {
      $resp = Invoke-RestMethod -Uri "$SiteUrl/api/materials/youtube-preflight" -Method Get
      if ($resp.ready) {
        Write-Host '  YouTube 下载前提已就绪！' -ForegroundColor Green
        return $true
      }
      Write-Host "  等待中... 代理:$($resp.checks.proxy.ok) cookies:$($resp.checks.cookies.ok)"
    } catch {
      Write-Host "  检测重试 $($i + 1)/12"
    }
    Start-Sleep -Seconds 3
  }
  return $false
}

try {
  Write-Host @'

  ╔══════════════════════════════════════╗
  ║   Super-Agent YouTube 一键配置工具   ║
  ╚══════════════════════════════════════╝
'@ -ForegroundColor Yellow

  Ensure-Config
  $plink = Find-Plink

  switch ($Mode) {
    'tunnel' {
      Test-LocalProxy
      Start-Tunnel $plink
    }
    'cookies' {
      Export-Cookies
      Upload-Config | Out-Null
    }
    default {
      Test-LocalProxy
      Start-Tunnel $plink
      Export-Cookies
      Upload-Config | Out-Null
      $ok = Wait-Ready
      if ($ok) {
        Write-Host "`n全部完成！请回到网页点击「检测就绪」，然后提交 YouTube 链接。" -ForegroundColor Green
        Start-Process $SiteUrl
      } else {
        Write-Warning '配置已上传，但服务器检测未通过。请确认 Clash 已开启且隧道窗口未关闭，然后在网页点「检测就绪」。'
      }
    }
  }
} catch {
  Write-Host "`n失败: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host @'

常见处理：
  1. 先打开 Clash，确认能访问 YouTube
  2. 在 Chrome 登录 YouTube 账号
  3. 关闭所有 Chrome 窗口后重新运行本脚本
  4. 回到网页点「检测就绪」
'@ -ForegroundColor Yellow
  exit 1
}
