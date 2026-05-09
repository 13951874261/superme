$ErrorActionPreference = 'Stop'

$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent'
$RemoteApiRoot = '/opt/vocab-server'
$HostKey = 'ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfF'
$HostKeyOptions = @('-hostkey', $HostKey)

$Pscp = (Get-Command pscp.exe -ErrorAction SilentlyContinue).Source
$Plink = (Get-Command plink.exe -ErrorAction SilentlyContinue).Source

if (-not $Pscp -or -not $Plink) {
  throw 'pscp.exe / plink.exe not found. Install PuTTY and add pscp/plink to PATH first.'
}

$Password = Read-Host 'Enter server password' -AsSecureString
$PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($PasswordPtr)

function Invoke-RemoteCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  & $Plink -ssh @HostKeyOptions -pw $PlainPassword -batch $ServerHost $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Remote command failed: $Command"
  }
}

function Send-File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  & $Pscp @HostKeyOptions -pw $PlainPassword -batch $Source $Destination
  if ($LASTEXITCODE -ne 0) {
    throw "Upload failed: $Source -> $Destination"
  }
}

try {
  Set-Location $ProjectRoot

  Write-Host 'Installing dependencies...' -ForegroundColor Cyan
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }

  Write-Host 'Building frontend...' -ForegroundColor Cyan
  pnpm build
  if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

  Write-Host 'Uploading frontend...' -ForegroundColor Cyan
  Send-File "$ProjectRoot\dist\index.html" "${ServerHost}:$RemoteWebRoot/index.html"

  Write-Host 'Uploading API files...' -ForegroundColor Cyan
  Send-File "$ProjectRoot\vocab-server\server.js" "${ServerHost}:$RemoteApiRoot/server.js"
  Send-File "$ProjectRoot\vocab-server\package.json" "${ServerHost}:$RemoteApiRoot/package.json"

  Write-Host 'Installing server dependencies...' -ForegroundColor Cyan
  Invoke-RemoteCommand "cd $RemoteApiRoot; npm install"

  Write-Host 'Reloading nginx...' -ForegroundColor Cyan
  Invoke-RemoteCommand 'sudo nginx -t; sudo systemctl reload nginx'

  Write-Host 'Restarting API service...' -ForegroundColor Cyan
  Invoke-RemoteCommand 'sudo systemctl daemon-reload; sudo systemctl restart super-agent-vocab.service; sudo systemctl status super-agent-vocab.service --no-pager'

  Write-Host 'Deployment finished.' -ForegroundColor Green
}
finally {
  if ($PasswordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr)
  }
}
