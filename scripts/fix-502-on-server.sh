#!/bin/bash
# Run ON THE SERVER after: ssh ubuntu@150.158.34.217
# Usage: bash fix-502-on-server.sh

set -u

SERVICE="super-agent-vocab.service"
API_ROOT="/var/www/super-agent/vocab-server"
DB_DIR="/var/www/super-agent"
PORT="3001"

section() {
  echo ""
  echo "========================================================"
  echo " $1"
  echo "========================================================"
}

section "1/7 systemd 配置"
systemctl cat "$SERVICE" 2>/dev/null | grep -E 'ExecStart|WorkingDirectory|User=' || echo "service file not found"

section "2/7 服务状态"
systemctl is-active "$SERVICE" 2>/dev/null || echo "inactive"
systemctl status "$SERVICE" --no-pager -l 2>/dev/null | head -n 20 || true

section "3/7 server.js 语法检查"
if node --check "$API_ROOT/server.js" 2>&1; then
  echo "OK: syntax valid"
else
  echo "FAIL: server.js has syntax errors — must re-upload fixed file from local"
fi

section "4/7 端口 $PORT"
ss -tulnp 2>/dev/null | grep ":${PORT} " || echo "PORT ${PORT} NOT LISTENING"

section "5/7 本机 API 探测"
curl -s -o /dev/null -w "127.0.0.1:${PORT}/api/vocab/stats -> HTTP %{http_code}\n" "http://127.0.0.1:${PORT}/api/vocab/stats" || echo "curl failed"
curl -s -o /dev/null -w "nginx /api/vocab/stats -> HTTP %{http_code}\n" "http://127.0.0.1/api/vocab/stats" || echo "nginx curl failed"

section "6/7 Nginx upstream 错误"
sudo tail -n 20 /var/log/nginx/error.log 2>/dev/null | grep -Ei 'connect|upstream|refused|502' || echo "no recent upstream errors"

section "7/7 最近服务日志"
sudo journalctl -u "$SERVICE" -n 50 --no-pager 2>/dev/null || echo "no journal logs"

section "自动修复（常见项）"
# Fix app.js -> server.js
if grep -q 'app.js' /etc/systemd/system/"$SERVICE" 2>/dev/null; then
  echo "Fixing ExecStart: app.js -> server.js"
  sudo sed -i 's|vocab-server/app.js|vocab-server/server.js|g' /etc/systemd/system/"$SERVICE"
  sudo systemctl daemon-reload
fi

# Ensure dirs and db permissions
sudo mkdir -p "$DB_DIR"
sudo chown -R ubuntu:ubuntu "$DB_DIR"
sudo chmod 755 "$DB_DIR"
if [ -f "$DB_DIR/vocab.db" ]; then
  sudo chown ubuntu:ubuntu "$DB_DIR/vocab.db"*
fi

# Install deps if node_modules missing
if [ ! -d "$API_ROOT/node_modules/better-sqlite3" ]; then
  echo "Installing npm dependencies..."
  sudo -u ubuntu bash -lc "cd '$API_ROOT' && npm install"
fi

# Restart if syntax OK
if node --check "$API_ROOT/server.js" >/dev/null 2>&1; then
  echo "Restarting $SERVICE ..."
  sudo systemctl restart "$SERVICE"
  sleep 2
  systemctl is-active "$SERVICE" && echo "Service is active" || echo "Service still failing"
  curl -s -o /dev/null -w "After restart: HTTP %{http_code}\n" "http://127.0.0.1:${PORT}/api/vocab/stats"
else
  echo "Skip restart: fix server.js syntax first (re-upload from local)"
fi

echo ""
echo "If still failing, run foreground debug:"
echo "  sudo systemctl stop $SERVICE"
echo "  cd $API_ROOT && sudo -u ubuntu NODE_ENV=production node server.js"
