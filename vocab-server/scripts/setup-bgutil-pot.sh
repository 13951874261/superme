#!/usr/bin/env bash
set -euo pipefail
export HTTP_PROXY="${HTTP_PROXY:-http://127.0.0.1:17897}"
export HTTPS_PROXY="${HTTPS_PROXY:-http://127.0.0.1:17897}"
export ALL_PROXY="${ALL_PROXY:-http://127.0.0.1:17897}"
export NO_PROXY="127.0.0.1,localhost"

echo "=== docker pull bgutil ==="
if ! docker ps -a --format '{{.Names}}' | grep -qx bgutil-provider; then
  docker pull brainicism/bgutil-ytdlp-pot-provider:latest
  docker run --name bgutil-provider -d --init --restart unless-stopped --net=host \
    -e HTTP_PROXY="$HTTP_PROXY" \
    -e HTTPS_PROXY="$HTTPS_PROXY" \
    -e ALL_PROXY="$ALL_PROXY" \
    -e NO_PROXY="$NO_PROXY" \
    brainicism/bgutil-ytdlp-pot-provider:latest
else
  docker start bgutil-provider >/dev/null || true
fi
sleep 2
docker ps --filter name=bgutil-provider --format '{{.Names}} {{.Status}}'
curl -sS --max-time 5 http://127.0.0.1:4416/ || true
echo

PLUGIN_DIR="/home/ubuntu/.config/yt-dlp/plugins"
mkdir -p "$PLUGIN_DIR"
if [ ! -f "$PLUGIN_DIR/bgutil-ytdlp-pot-provider.zip" ]; then
  echo "=== download plugin zip ==="
  curl -fL --max-time 60 -o "$PLUGIN_DIR/bgutil-ytdlp-pot-provider.zip" \
    "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip"
fi
ls -lh "$PLUGIN_DIR"

YTDLP="/var/www/super-agent/vocab-server/node_modules/youtube-dl-exec/bin/yt-dlp"
echo "=== yt-dlp verbose pot providers ==="
"$YTDLP" -v --simulate --force-ipv4 --proxy "$HTTP_PROXY" --js-runtimes node:/usr/bin/node \
  "https://www.youtube.com/watch?v=YoBc3zII7lg" 2>&1 | grep -E 'PO Token|pot|bot|ERROR|WARNING|Available formats|Downloading' | head -40
