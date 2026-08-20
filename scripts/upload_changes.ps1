# scripts/upload_changes.ps1
# Deploy script for uploading current frontend and backend changes to the server

$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent/dist'
$RemoteApiRoot = '/var/www/super-agent/vocab-server'

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "[START] Starting deployment to server..." -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Frontend Build
Write-Host "Step 1: Building frontend locally..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed, aborting deployment."
    exit 1
}

# 2. Upload Frontend index.html
Write-Host "Step 2: Uploading dist/index.html..." -ForegroundColor Yellow
scp .\dist\index.html "${ServerHost}:${RemoteWebRoot}/index.html"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend upload failed, aborting deployment."
    exit 1
}

# 3. Upload Backend server.js
Write-Host "Step 3: Uploading server.js..." -ForegroundColor Yellow
scp .\vocab-server\server.js "${ServerHost}:${RemoteApiRoot}/server.js"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend upload failed, aborting deployment."
    exit 1
}

# 4. Remote Nginx Reload and Service Restart
Write-Host "Step 4: Reloading Nginx and restarting backend service on remote server..." -ForegroundColor Yellow
ssh $ServerHost 'sudo nginx -t && sudo systemctl reload nginx && sudo systemctl restart super-agent-vocab.service'
if ($LASTEXITCODE -ne 0) {
    Write-Error "Remote service reload or restart failed!"
    exit 1
}

Write-Host "=============================================" -ForegroundColor Green
Write-Host "[SUCCESS] Deployment completed successfully!" -ForegroundColor Green
Write-Host "[URL] Access URL: https://app.liujingzhuwo.site/" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
