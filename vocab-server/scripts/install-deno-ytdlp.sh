#!/usr/bin/env bash
set -euo pipefail
export DENO_INSTALL="/home/ubuntu/.deno"
export HTTP_PROXY="http://127.0.0.1:17897"
export HTTPS_PROXY="$HTTP_PROXY"
export ALL_PROXY="$HTTP_PROXY"
export NO_PROXY="127.0.0.1,localhost"
if [ ! -x "$DENO_INSTALL/bin/deno" ]; then
  curl -fsSL https://deno.land/install.sh | sh
fi
"$DENO_INSTALL/bin/deno" --version
YTDLP="/var/www/super-agent/vocab-server/node_modules/youtube-dl-exec/bin/yt-dlp"
"$YTDLP" -v --simulate --force-ipv4 --proxy "$HTTP_PROXY" \
  --js-runtimes "deno:$DENO_INSTALL/bin/deno" \
  --extractor-args "youtube:player_client=mweb" \
  "https://www.youtube.com/watch?v=YoBc3zII7lg" 2>&1 | tail -50
