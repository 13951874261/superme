#!/bin/bash
# ============================================================
# Super-Agent 服务器后台报错日志查看脚本
# 用途: 登录服务器后快速查看 vocab-server 与 Nginx 报错
# 用法:
#   bash view-server-logs.sh          # 查看最近报错快照
#   bash view-server-logs.sh -f       # 实时跟踪后端日志
#   bash view-server-logs.sh -n 100   # 指定行数 (默认 50)
# ============================================================

set -euo pipefail

SERVICE="super-agent-vocab.service"
APP_PORT="3001"
APP_LOG_DIR="/var/www/super-agent/logs"
NGINX_ERROR_LOG="/var/log/nginx/error.log"
LINES=50
FOLLOW=false

usage() {
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

while getopts ":fn:h" opt; do
    case "$opt" in
        f) FOLLOW=true ;;
        n) LINES="$OPTARG" ;;
        h) usage ;;
        *) echo "未知参数: -$OPTARG (使用 -h 查看帮助)" >&2; exit 1 ;;
    esac
done

section() {
    echo ""
    echo "========================================================"
    echo " $1"
    echo "========================================================"
}

run_journalctl() {
    if ! command -v journalctl >/dev/null 2>&1; then
        echo "journalctl 不可用"
        return 1
    fi
    sudo journalctl -u "$SERVICE" "$@"
}

if $FOLLOW; then
    section "实时跟踪 $SERVICE 日志 (Ctrl+C 退出)"
    run_journalctl -f
    exit 0
fi

section "Super-Agent 后台报错日志诊断"

echo ""
echo "[1/5] 服务状态"
echo "--------------------------------------------------------"
systemctl is-active "$SERVICE" 2>/dev/null && systemctl status "$SERVICE" --no-pager -l | head -n 15 || echo "服务未运行或未找到: $SERVICE"

echo ""
echo "[2/5] 后端最近日志 (journalctl, 最后 ${LINES} 行)"
echo "--------------------------------------------------------"
run_journalctl -n "$LINES" --no-pager 2>/dev/null || echo "无法读取 systemd 日志"

echo ""
echo "[3/5] 后端报错关键字过滤 (Error / Exception / 502 / PayloadTooLarge)"
echo "--------------------------------------------------------"
run_journalctl -n 500 --no-pager 2>/dev/null \
    | grep -Ei 'error|exception|fail|502|PayloadTooLarge|ECONNREFUSED|ENOMEM' \
    | tail -n "$LINES" \
    || echo "未发现明显报错关键字"

echo ""
echo "[4/5] Nginx 错误日志 (最后 ${LINES} 行)"
echo "--------------------------------------------------------"
if [ -r "$NGINX_ERROR_LOG" ]; then
    sudo tail -n "$LINES" "$NGINX_ERROR_LOG"
elif [ -f "$NGINX_ERROR_LOG" ]; then
    sudo tail -n "$LINES" "$NGINX_ERROR_LOG" 2>/dev/null || echo "需要 sudo 权限读取: $NGINX_ERROR_LOG"
else
    echo "未找到: $NGINX_ERROR_LOG"
fi

echo ""
echo "[5/5] 应用日志文件 + 端口 ${APP_PORT}"
echo "--------------------------------------------------------"
if [ -d "$APP_LOG_DIR" ]; then
    ls -la "$APP_LOG_DIR" 2>/dev/null || true
    LATEST_LOG=$(ls -t "$APP_LOG_DIR"/*.log 2>/dev/null | head -1 || true)
    if [ -n "${LATEST_LOG:-}" ]; then
        echo ""
        echo "最近应用日志: $LATEST_LOG"
        tail -n "$LINES" "$LATEST_LOG"
    else
        echo "应用日志目录存在，但无 .log 文件"
    fi
else
    echo "应用日志目录未找到: $APP_LOG_DIR"
fi

echo ""
echo "端口 ${APP_PORT} 监听状态:"
ss -tulnp 2>/dev/null | grep ":${APP_PORT} " || netstat -tulnp 2>/dev/null | grep ":${APP_PORT} " || echo "端口 ${APP_PORT} 未被监听"

echo ""
echo "========================================================"
echo " 常用命令:"
echo "   sudo journalctl -u $SERVICE -n 100 --no-pager"
echo "   sudo journalctl -u $SERVICE -f"
echo "   sudo tail -f $NGINX_ERROR_LOG"
echo "   curl -s http://127.0.0.1:${APP_PORT}/api/vocab/health"
echo "========================================================"
