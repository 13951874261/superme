$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent/dist' # Remote frontend Nginx web root directory

# Detect local PuTTY toolchain
$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source

if (-not $Pscp -or -not $Plink) {
  # Fallback strategy: use native scp and ssh
  Write-Host 'pscp.exe/plink.exe not found. Fallback to native OpenSSH (scp/ssh) for deployment...' -ForegroundColor Yellow
  try {
    Set-Location $ProjectRoot

    Write-Host '1. Installing dependencies...' -ForegroundColor Cyan
    pnpm install

    Write-Host '2. Building frontend assets...' -ForegroundColor Cyan
    pnpm build

    Write-Host '3. Uploading static files to server...' -ForegroundColor Cyan
    scp -r .\dist\* "${ServerHost}:${RemoteWebRoot}/"

    Write-Host '4. Reloading Nginx service remotely...' -ForegroundColor Cyan
    ssh $ServerHost "sudo nginx -t && sudo systemctl reload nginx"

    Write-Host 'Deployment succeeded (OpenSSH mode)!' -ForegroundColor Green
  } catch {
    Write-Error $_
  }
  exit
}

# PuTTY mode: enter password once
$Password = Read-Host 'Enter server password' -AsSecureString
$PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)

function Invoke-RemoteCommand {
  param([string]$Command)
  & $Plink -ssh -pw $PlainPassword -batch $ServerHost $Command
  if ($LASTEXITCODE -ne 0) { throw "Remote command failed: $Command" }
}

function Send-Files {
  param([string]$Source, [string]$Destination)
  & $Pscp -r -pw $PlainPassword -batch $Source $Destination
  if ($LASTEXITCODE -ne 0) { throw "Upload failed: $Source -> $Destination" }
}

try {
  Set-Location $ProjectRoot
  
  Write-Host '1. Installing local dependencies...' -ForegroundColor Cyan
  pnpm install

  Write-Host '2. Building frontend assets...' -ForegroundColor Cyan
  pnpm build

  Write-Host '3. Uploading frontend assets...' -ForegroundColor Cyan
  Send-Files "$ProjectRoot\dist\*" "${ServerHost}:${RemoteWebRoot}/"

  Write-Host '4. Reloading Nginx configuration...' -ForegroundColor Cyan
  Invoke-RemoteCommand 'sudo nginx -t && sudo systemctl reload nginx'

  Write-Host 'Deployment succeeded (PuTTY mode)!' -ForegroundColor Green
}
finally {
  if ($PasswordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
  }
}
