#!/bin/bash
# 文件名: scripts/deploy.sh
# 作用: 自动化构建并将前端资产发布到服务器

set -e

echo "开始构建 Super Agent 前端..."
npm run build

echo "构建完成，准备部署..."

SERVER_USER="root"
SERVER_IP="您的服务器公网IP"
SERVER_PORT="22"
FRONTEND_REMOTE_DIR="/var/www/super-agent-front"

 echo "上传前端静态文件..."
rsync -avz -e "ssh -p $SERVER_PORT" --delete dist/ $SERVER_USER@$SERVER_IP:$FRONTEND_REMOTE_DIR

echo "部署完毕。"
