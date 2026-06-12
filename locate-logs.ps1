# ============================================================
# Super-Agent Remote Log Diagnostic Tool
# This script SSHs to the remote server to pull backend API service 
# logs and Nginx logs to identify the exact cause of 500 exceptions.
# ============================================================
$ServerHost = 'ubuntu@150.158.34.217'

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " 🔍 Super-Agent Backend Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "`n[1/2] Fetching super-agent-vocab API Service Logs..." -ForegroundColor Yellow
Write-Host "Command: sudo journalctl -u super-agent-vocab.service -n 40 --no-pager" -ForegroundColor DarkGray
Write-Host "--------------------------------------------------------" -ForegroundColor White
ssh $ServerHost "sudo journalctl -u super-agent-vocab.service -n 40 --no-pager"
Write-Host "--------------------------------------------------------" -ForegroundColor White

Write-Host "`n[2/2] Fetching Nginx Error Logs (If any)..." -ForegroundColor Yellow
Write-Host "Command: sudo tail -n 20 /var/log/nginx/error.log" -ForegroundColor DarkGray
Write-Host "--------------------------------------------------------" -ForegroundColor White
ssh $ServerHost "sudo tail -n 20 /var/log/nginx/error.log"
Write-Host "--------------------------------------------------------" -ForegroundColor White

Write-Host "`n🎉 Diagnosis command execution complete. Please review the output above." -ForegroundColor Green
