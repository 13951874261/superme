#!/bin/bash
# ============================================================
# Super-Agent 502 Error Diagnostic Script
# 用途: 从本地电脑一键诊断服务器 502 错误
# 用法: bash diagnose-502.sh
# ============================================================

SERVER="root@liujingzhuwo.site"

echo "========================================================"
echo " 🌐 Remote Diagnostic Tool - 502 Error Analysis"
echo "========================================================"

# 远程执行诊断命令
ssh $SERVER <<'REMOTE_COMMANDS'

echo -e "\033[33m[1/8] PM2 进程状态\033[0m"
echo "--------------------------------------------------------"
pm2 list 2>/dev/null || echo "PM2 未安装或未运行"

echo -e "\033[33m[2/8] PM2 最近日志 (vocab-server)\033[0m"
echo "--------------------------------------------------------"
pm2 logs vocab-server --lines 30 --nostream 2>/dev/null || echo "PM2 日志未找到"

echo -e "\033[33m[3/8] Systemd 服务状态\033[0m"
echo "--------------------------------------------------------"
systemctl status super-agent-vocab.service --no-pager 2>/dev/null || echo "Systemd 服务未找到"

echo -e "\033[33m[4/8] Nginx 错误日志 (最近 30 行)\033[0m"
echo "--------------------------------------------------------"
tail -n 30 /var/log/nginx/error.log 2>/dev/null || echo "Nginx 错误日志未找到"

echo -e "\033[33m[5/8] Nginx 访问日志中的 502 错误\033[0m"
echo "--------------------------------------------------------"
tail -n 100 /var/log/nginx/access.log 2>/dev/null | grep "502" | tail -n 20 || echo "无 502 错误记录"

echo -e "\033[33m[6/8] 应用日志文件\033[0m"
echo "--------------------------------------------------------"
ls -la /var/www/super-agent/logs/ 2>/dev/null || echo "应用日志目录未找到"
tail -n 20 /var/www/super-agent/logs/*.log 2>/dev/null || echo "无应用日志文件"

echo -e "\033[33m[7/8] 端口占用情况 (10808)\033[0m"
echo "--------------------------------------------------------"
ss -tulnp 2>/dev/null | grep 10808 || netstat -tulnp 2>/dev/null | grep 10808 || echo "端口 10808 未被监听"

echo -e "\033[33m[8/8] 系统资源\033[0m"
echo "--------------------------------------------------------"
df -h
free -h
uptime

REMOTE_COMMANDS

echo ""
echo "========================================================"
echo -e " \033[32m🎉 诊断完成！请检查以上输出。\033[0m"
echo "========================================================"