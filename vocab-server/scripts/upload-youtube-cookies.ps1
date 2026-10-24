param(
  [string]$CookiesFile = "$env:USERPROFILE\Downloads\www.youtube.com_cookies.txt",
  [string]$SSHPassword = "19890430@lmq"
)

$ErrorActionPreference = "Stop"
$hostkey = "ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE"
$remote = "ubuntu@150.158.34.217"
$remotePath = "/var/www/super-agent/vocab-server/secrets/youtube.cookies.txt"

if (-not (Test-Path $CookiesFile)) {
  Write-Error "Cookies file not found: $CookiesFile"
}

$hasLogin = Select-String -Path $CookiesFile -Pattern "`tLOGIN_INFO`t" -Quiet
if (-not $hasLogin) {
  Write-Warning "File missing LOGIN_INFO cookie; YouTube bot check may still fail."
}

pscp -hostkey $hostkey -pw $SSHPassword $CookiesFile "${remote}:${remotePath}"
plink -hostkey $hostkey -pw $SSHPassword -batch $remote "grep -q '^YTDLP_COOKIES_FILE=' /var/www/super-agent/vocab-server/.env && sed -i 's|^YTDLP_COOKIES_FILE=.*|YTDLP_COOKIES_FILE=$remotePath|' /var/www/super-agent/vocab-server/.env || echo 'YTDLP_COOKIES_FILE=$remotePath' >> /var/www/super-agent/vocab-server/.env; sudo systemctl restart super-agent-vocab.service; sleep 2; curl -s http://127.0.0.1:3001/api/vocab/health"

Write-Host "Uploaded cookies and restarted super-agent-vocab."
