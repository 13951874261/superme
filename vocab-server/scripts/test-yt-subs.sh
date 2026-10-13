#!/usr/bin/env bash
if [ "${RUN_LIVE_NETWORK_TESTS:-}" != 'true' ]; then
  printf '%s\n' '测试隔离：联网诊断需显式设置 RUN_LIVE_NETWORK_TESTS=true' >&2
  exit 1
fi
YTDLP=/var/www/super-agent/vocab-server/node_modules/youtube-dl-exec/bin/yt-dlp
URL='https://www.youtube.com/watch?v=YoBc3zII7lg'
"$YTDLP" --proxy http://127.0.0.1:17897 --js-runtimes deno:/home/ubuntu/.deno/bin/deno --list-subs --skip-download "$URL" 2>&1 | tail -30
