#!/bin/bash
# 文件位置: super-agent/scripts/deploy.sh

set -e

echo "==================================="
echo "🚀 开始构建 Super Agent 前端沙盘..."
echo "==================================="

# 编译打包 (Vite)
npm run build

echo "📦 构建完成，准备同步到线上服务器..."

# ============== 服务器配置 (请根据实际情况修改) ==============
SERVER_USER="root"
SERVER_IP="您的服务器公网IP"
SERVER_PORT="22"
REMOTE_DIR="/var/www/super-agent-front"  # 您的 Nginx 前端根目录
# ==========================================================

# 增量上传
rsync -avz -e "ssh -p $SERVER_PORT" --delete dist/ $SERVER_USER@$SERVER_IP:$REMOTE_DIR

echo "✅ 部署完毕！沙盘系统已成功上线。"
