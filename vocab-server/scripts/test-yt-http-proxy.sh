#!/usr/bin/env bash
if [ "${RUN_LIVE_NETWORK_TESTS:-}" != 'true' ]; then
  printf '%s\n' '测试隔离：联网诊断需显式设置 RUN_LIVE_NETWORK_TESTS=true' >&2
  exit 1
fi
YTDLP="/var/www/super-agent/vocab-server/node_modules/youtube-dl-exec/bin/yt-dlp"
NODEBIN=$(command -v node)
echo "=== android client ==="
"$YTDLP" --force-ipv4 --proxy http://127.0.0.1:17897 \
  --js-runtimes "node:${NODEBIN}" \
  --extractor-args "youtube:player_client=android" \
  --skip-download --print "%(title)s | %(duration)s" --retries 2 \
  "https://www.youtube.com/watch?v=YoBc3zII7lg" || true
echo "=== ios client ==="
"$YTDLP" --force-ipv4 --proxy http://127.0.0.1:17897 \
  --js-runtimes "node:${NODEBIN}" \
  --extractor-args "youtube:player_client=ios" \
  --skip-download --print "%(title)s | %(duration)s" --retries 2 \
  "https://www.youtube.com/watch?v=YoBc3zII7lg" || true
echo "=== tv client ==="
"$YTDLP" --force-ipv4 --proxy http://127.0.0.1:17897 \
  --js-runtimes "node:${NODEBIN}" \
  --extractor-args "youtube:player_client=tv" \
  --skip-download --print "%(title)s | %(duration)s" --retries 2 \
  "https://www.youtube.com/watch?v=YoBc3zII7lg" || true
