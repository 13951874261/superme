# Super-Agent Vocab Server 快速热更新脚本
$serverIP = "150.158.34.217"
$serverUser = "ubuntu"
$localFile = "D:\cursor\work\super-agent\vocab-server\server.js"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Super-Agent 后端热更新部署" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 上传文件
Write-Host "[1/2] 上传 server.js..." -ForegroundColor Yellow
scp $localFile "${serverUser}@${serverIP}:/var/www/super-agent/vocab-server/server.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 上传成功`n" -ForegroundColor Green
    
    # 重启服务
    Write-Host "[2/2] 重启服务..." -ForegroundColor Yellow
    ssh "${serverUser}@${serverIP}" "sudo systemctl restart super-agent-vocab.service"
    
    Write-Host "`n✓ 部署完成！请在浏览器刷新测试" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
} else {
    Write-Host "✗ 上传失败" -ForegroundColor Red
}
