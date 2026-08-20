# ============================================================
# Super-Agent Remote Log Diagnostic Tool
# 用途: 登录服务器后快速查看后端 API 服务和 Nginx 日志
# 用法: 直接在服务器上运行，或通过 SSH 远程执行
# ============================================================

$ServerHost = 'root@liujingzhuwo.site'

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " 🔍 Super-Agent Backend Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# ========== 1. PM2 进程状态 ==========
Write-Host "`n[1/6] PM2 进程状态" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
pm2 list
Write-Host "--------------------------------------------------------" -ForegroundColor White

# ========== 2. PM2 最近日志 (vocab-server) ==========
Write-Host "`n[2/6] PM2 最近日志 (vocab-server, 最后 50 行)" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
pm2 logs vocab-server --lines 50 --nostream 2>/dev/null
Write-Host "--------------------------------------------------------" -ForegroundColor White

# ========== 3. Systemd 服务状态 ==========
Write-Host "`n[3/6] Systemd 服务状态" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
systemctl status super-agent-vocab.service --no-pager 2>/dev/null || echo "Systemd 服务未找到，可能使用 PM2 管理"
Write-Host "--------------------------------------------------------" -ForegroundColor White

# ========== 4. Nginx 错误日志 ==========
Write-Host "`n[4/6] Nginx 错误日志 (最近 30 行)" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
tail -n 30 /var/log/nginx/error.log 2>/dev/null || echo "Nginx 日志未找到"
Write-Host "--------------------------------------------------------" -ForegroundColor White

# ========== 5. 应用日志文件 ==========
Write-Host "`n[5/6] 应用日志文件" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
if (Test-Path "/var/www/super-agent/logs/") {
    Get-ChildItem /var/www/super-agent/logs/ -ErrorAction SilentlyContinue
    Write-Host "`n最近日志内容:"
    Get-ChildItem /var/www/super-agent/logs/*.log -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ForEach-Object {
        tail -n 30 $_.FullName
    }
} else {
    echo "应用日志目录未找到: /var/www/super-agent/logs/"
}
Write-Host "--------------------------------------------------------" -ForegroundColor White

# ========== 6. 端口占用情况 ==========
Write-Host "`n[6/6] 端口占用情况" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
ss -tulnp | grep 10808 2>/dev/null || netstat -tulnp | grep 10808 2>/dev/null || echo "端口 10808 未被监听"
Write-Host "--------------------------------------------------------" -ForegroundColor White

# ========== 7. 磁盘空间 ==========
Write-Host "`n[7/7] 磁盘空间" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
df -h
Write-Host "--------------------------------------------------------" -ForegroundColor White

# ========== 8. 内存使用情况 ==========
Write-Host "`n[8/8] 内存使用情况" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
free -h
Write-Host "--------------------------------------------------------" -ForegroundColor White

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " 🎉 诊断命令执行完毕。请检查以上输出。" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green