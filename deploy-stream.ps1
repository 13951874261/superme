# Super-Agent Vocab Server 流式热更新部署脚本
$serverIP = "150.158.34.217"
$serverUser = "ubuntu"
$localFile = "D:\cursor\work\super-agent\vocab-server\server.js"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Super-Agent 流式热更新部署" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. 上传文件
Write-Host "[1/2] 上传 server.js..." -ForegroundColor Yellow
scp $localFile "${serverUser}@${serverIP}:/var/www/super-agent/vocab-server/server.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 上传成功`n" -ForegroundColor Green
    
    # 2. 重启服务
    Write-Host "[2/2] 重启服务..." -ForegroundColor Yellow
    ssh "${serverUser}@${serverIP}" "sudo systemctl restart super-agent-vocab.service"
    
    Write-Host "`n✓ 部署完成！" -ForegroundColor Green
    Write-Host "`n请在浏览器打开 https://app.liujingzhuwo.site/" -ForegroundColor Yellow
    Write-Host "按 Ctrl+Shift+R 强制刷新后点击 [AI自动生成今日长文并提纯]" -ForegroundColor Yellow
    Write-Host "`n现在将实时转发 Dify 的流式响应，不会再出现 524 超时错误！" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
} else {
    Write-Host "✗ 上传失败" -ForegroundColor Red
}
