$ErrorActionPreference = 'Stop'

# 项目基础配置
$ProjectRoot = 'D:\cursor\work\super-agent'
$ServerHost = 'ubuntu@150.158.34.217'
$RemoteWebRoot = '/var/www/super-agent/dist'

try {
    # 切换至本地项目根目录
    Set-Location $ProjectRoot
    
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host '  开始部署：高阶审美与阶层软实力系统' -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan

    # 1. 依赖安装与版本校正
    Write-Host '1. 正在校验本地依赖环境 (pnpm install)...' -ForegroundColor Yellow
    pnpm install

    # 2. 前端静态编译
    Write-Host '2. 正在执行打包编译 (pnpm build)...' -ForegroundColor Yellow
    pnpm build

    # 3. 同步上传静态产物
    Write-Host '3. 正在上传编译产物 index.html 至生产服务器...' -ForegroundColor Yellow
    scp .\dist\index.html "${ServerHost}:${RemoteWebRoot}/index.html"
    
    # 4. 服务器配置热重载
    Write-Host '4. 正在连接远程服务器重载 Nginx 服务配置...' -ForegroundColor Yellow
    ssh $ServerHost "sudo nginx -t && sudo systemctl reload nginx"

    Write-Host '----------------------------------------' -ForegroundColor Green
    Write-Host '【部署成功】高阶审美系统最新代码已同步至生产服务器！' -ForegroundColor Green
    Write-Host '请在浏览器打开 https://app.liujingzhuwo.site/ 并按 Ctrl+Shift+R 强刷缓存。' -ForegroundColor Green
    Write-Host '----------------------------------------' -ForegroundColor Green
} catch {
    Write-Host '----------------------------------------' -ForegroundColor Red
    Write-Host "【部署失败】异常中断已触发。错误详情: $_" -ForegroundColor Red
    Write-Host '----------------------------------------' -ForegroundColor Red
    exit 1
}
