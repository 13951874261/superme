#!/bin/bash
# 在 Ubuntu 服务器上安装 edge-tts（供 vocab-server TTS fallback 使用）
set -euo pipefail

echo "==> Installing edge-tts for ubuntu user..."
if ! command -v pip3 >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y python3-pip
fi

pip3 install --user --upgrade edge-tts

EDGE_BIN="$HOME/.local/bin/edge-tts"
if [ -x "$EDGE_BIN" ]; then
  echo "==> edge-tts installed: $EDGE_BIN"
  "$EDGE_BIN" --version || true
else
  echo "==> Checking python3 -m edge_tts..."
  python3 -m edge_tts --version
fi

echo "==> Done. Restart vocab service: sudo systemctl restart super-agent-vocab.service"
