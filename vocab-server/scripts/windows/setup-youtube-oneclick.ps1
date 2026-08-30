# Super-Agent YouTube one-click setup (Windows PowerShell 5.1+)
# Run via setup-youtube.bat

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
  Write-Host ""
  Write-Host "==> $Msg" -ForegroundColor Cyan
}

function Load-Config {
  if (Test-Path $ConfigPath) {
    return Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
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
    Write-Host '[Info] First run: enter server SSH password (saved locally only)' -ForegroundColor Yellow
    $secure = Read-Host 'SSH password'
    $script:SSHPassword = [string]$secure
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
    "${env:ProgramFiles(x86)}\PuTTY\plink.exe"
  )
  foreach ($c in $candidates) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { return (Get-Command $c).Source }
    if (Test-Path $c) { return $c }
  }
  Write-Step 'Installing PuTTY (plink)...'
  winget install -e --id PuTTY.PuTTY --accept-package-agreements --accept-source-agreements | Out-Null
  if (Test-Path "$env:ProgramFiles\PuTTY\plink.exe") { return "$env:ProgramFiles\PuTTY\plink.exe" }
  throw 'plink not found. Install PuTTY and retry.'
}

function Test-LocalProxy {
  Write-Step "Check local proxy 127.0.0.1:$LocalProxyPort"
  $ports = @($LocalProxyPort, 7897, 7890, 10808) | Select-Object -Unique
  foreach ($p in $ports) {
    $ok = Test-NetConnection -ComputerName 127.0.0.1 -Port $p -WarningAction SilentlyContinue
    if ($ok.TcpTestSucceeded) {
      $script:LocalProxyPort = $p
      Write-Host "  Local proxy port: $p" -ForegroundColor Green
      return
    }
  }
  throw 'Local proxy not found. Open Clash first (port 7897).'
}

function Start-Tunnel([string]$PlinkPath) {
  Write-Step 'Start SSH reverse tunnel (keep window minimized)'
  $existing = Get-Process plink -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host '  plink already running, skip' -ForegroundColor Yellow
    return
  }
  $tunnelSpec = ('{0}:127.0.0.1:{1}' -f $RemoteProxyPort, $LocalProxyPort)
  $plinkArgs = @(
    '-hostkey', $HostKey,
    '-pw', $SSHPassword,
    '-N',
    '-R', $tunnelSpec,
    $ServerHost
  )
  Start-Process -FilePath $PlinkPath -ArgumentList $plinkArgs -WindowStyle Minimized | Out-Null
  Start-Sleep -Seconds 3
  Write-Host '  Tunnel started' -ForegroundColor Green
}

function Export-Cookies {
  Write-Step 'Export YouTube cookies from Chrome'
  if (-not (Test-Path $ExportPy)) {
    throw "export script not found: $ExportPy"
  }
  $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
  if (-not $pythonCmd) { throw 'Python 3 not found' }
  $env:OUT = $CookiesOut
  & $pythonCmd.Source $ExportPy
  if (-not (Test-Path $CookiesOut)) {
    $legacyPath = Join-Path (Split-Path $ScriptRoot -Parent) 'secrets\youtube.cookies.txt'
    if (Test-Path $legacyPath) {
      Copy-Item -Path $legacyPath -Destination $CookiesOut -Force
    }
  }
  if (-not (Test-Path $CookiesOut)) {
    throw ('cookie export failed; expected file: {0}' -f $CookiesOut)
  }
  $hasLogin = Select-String -Path $CookiesOut -Pattern "`tLOGIN_INFO`t" -Quiet
  if (-not $hasLogin) {
    throw 'cookies missing LOGIN_INFO. Login YouTube in Chrome first.'
  }
  Write-Host "  Exported: $CookiesOut" -ForegroundColor Green
}

function Upload-Config {
  Write-Step 'Upload config to server'
  $proxy = "http://127.0.0.1:$RemoteProxyPort"
  $uri = "$SiteUrl/api/materials/youtube-config"

  $curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curlExe) {
    $raw = & curl.exe -sS -X POST $uri -F "proxy=$proxy" -F "cookies=@$CookiesOut;type=text/plain"
    if ($LASTEXITCODE -ne 0) {
      throw ('upload failed (curl exit {0})' -f $LASTEXITCODE)
    }
    $resp = $raw | ConvertFrom-Json
  } else {
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    try {
      $content = New-Object System.Net.Http.MultipartFormDataContent
      $null = $content.Add([System.Net.Http.StringContent]::new($proxy), 'proxy')
      $fileStream = [System.IO.File]::OpenRead($CookiesOut)
      try {
        $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('text/plain')
        $null = $content.Add($fileContent, 'cookies', [IO.Path]::GetFileName($CookiesOut))
        $task = $client.PostAsync($uri, $content)
        $task.Wait() | Out-Null
        $response = $task.Result
        $body = $response.Content.ReadAsStringAsync().Result
        if (-not $response.IsSuccessStatusCode) {
          throw ('upload failed HTTP {0}: {1}' -f [int]$response.StatusCode, $body)
        }
        $resp = $body | ConvertFrom-Json
      } finally {
        $fileStream.Close()
      }
    } finally {
      $client.Dispose()
    }
  }

  if (-not $resp.success) { throw 'server config failed' }
  Write-Host "  Proxy: $proxy" -ForegroundColor Green
  Write-Host '  Cookies uploaded' -ForegroundColor Green
  return $resp
}

function Wait-Ready {
  Write-Step 'Wait for server preflight ready'
  for ($i = 0; $i -lt 12; $i++) {
    try {
      $resp = Invoke-RestMethod -Uri "$SiteUrl/api/materials/youtube-preflight" -Method Get
      if ($resp.ready) {
        Write-Host '  YouTube preflight ready!' -ForegroundColor Green
        return $true
      }
      Write-Host ('  waiting... proxy={0} cookies={1}' -f $resp.checks.proxy.ok, $resp.checks.cookies.ok)
    } catch {
      Write-Host ('  retry {0}/12' -f ($i + 1))
    }
    Start-Sleep -Seconds 3
  }
  return $false
}

try {
  Write-Host ''
  Write-Host '  ======================================' -ForegroundColor Yellow
  Write-Host '   Super-Agent YouTube Setup' -ForegroundColor Yellow
  Write-Host '  ======================================' -ForegroundColor Yellow
  Write-Host ''

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
        Write-Host ''
        Write-Host 'Done! Open the site and click preflight check.' -ForegroundColor Green
        Start-Process $SiteUrl
      } else {
        Write-Warning 'Uploaded but preflight not ready. Keep Clash + tunnel running.'
      }
    }
  }
} catch {
  Write-Host ''
  Write-Host ('Failed: {0}' -f $_.Exception.Message) -ForegroundColor Red
  Write-Host ''
  Write-Host 'Tips:' -ForegroundColor Yellow
  Write-Host '  1. Open Clash and verify YouTube in browser' -ForegroundColor Yellow
  Write-Host '  2. Login YouTube in Chrome' -ForegroundColor Yellow
  Write-Host '  3. Close all Chrome windows and rerun setup-youtube.bat' -ForegroundColor Yellow
  Write-Host '  4. Click preflight check on web page' -ForegroundColor Yellow
  exit 1
}
