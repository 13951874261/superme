#!/usr/bin/env bash
set -u
YTDLP="/var/www/super-agent/vocab-server/node_modules/youtube-dl-exec/bin/yt-dlp"
URL="https://www.youtube.com/watch?v=YoBc3zII7lg"
PROXY="http://127.0.0.1:17897"

echo "=== node ==="
/usr/bin/node -v

echo "=== docker ==="
docker ps --filter name=bgutil-provider --format '{{.Names}} {{.Status}}'
curl -sS --max-time 3 http://127.0.0.1:4416/ | head -c 120
echo

echo "=== yt-dlp help js-runtimes ==="
"$YTDLP" --help 2>/dev/null | grep -A2 js-runtime | head -10

echo "=== verbose mweb + node + pot via clash ==="
"$YTDLP" -v --simulate --force-ipv4 \
  --proxy "$PROXY" \
  --js-runtimes "node:/usr/bin/node" \
  --extractor-args "youtube:player_client=mweb" \
  "$URL" 2>&1 | tail -80

echo "=== verbose default + node via warp socks if up ==="
curl -sS --max-time 8 -o /dev/null -w "warp:%{http_code}\n" -x socks5h://127.0.0.1:40000 https://www.youtube.com || echo "warp:fail"
"$YTDLP" -v --simulate --force-ipv4 \
  --proxy "socks5h://127.0.0.1:40000" \
  --js-runtimes "node:/usr/bin/node" \
  --extractor-args "youtube:player_client=mweb" \
  "$URL" 2>&1 | tail -40
