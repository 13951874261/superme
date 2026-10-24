#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"
$ServerHost  = "ubuntu@150.158.34.217"
$RemoteWebRoot = "/var/www/super-agent"
Write-Host "========== 增量部署: 仅同步前端源码 ==========" -ForegroundColor Cyan
$changedFiles = @(
    "src/components/modules/english/tabs/CustomThemeModal.tsx",
    "src/components/modules/EntertainmentModule.tsx",
    "src/constants/tabs.ts"
)
foreach ($file in $changedFiles) {
    if (Test-Path $file) {
        Write-Host "上传 $file ..." -ForegroundColor DarkGreen
        $remoteDir = $RemoteWebRoot + "/" + (Split-Path $file -Parent).Replace("\\", "/")
        plink -batch -pw "19890430@lmq" $ServerHost "mkdir -p ""$remoteDir"""
        pscp -batch -pw "19890430@lmq" $file "$ServerHost`:$remoteDir/"
    } else {
        Write-Warning "本地未找到 $file，跳过"
    }
}
Write-Host "========== 触发远程构建 & Nginx 重载 ==========" -ForegroundColor Cyan
plink -batch -pw "19890430@lmq" $ServerHost "cd $RemoteWebRoot && pnpm install --frozen-lockfile 2>&1 | tail -3 && pnpm build 2>&1 | tail -5 && sudo systemctl reload nginx"
Write-Host "========== 验证 ==========" -ForegroundColor Cyan
plink -batch -pw "19890430@lmq" $ServerHost "curl -sI https://app.liujingzhuwo.site/ | head -1"
Write-Host "完成！请在浏览器强制刷新 (Ctrl+Shift+R) 验证。" -ForegroundColor Green
