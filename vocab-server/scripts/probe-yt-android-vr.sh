#!/usr/bin/env bash
set -u
YTDLP="/var/www/super-agent/vocab-server/node_modules/youtube-dl-exec/bin/yt-dlp"
URL="https://www.youtube.com/watch?v=YoBc3zII7lg"
PROXY="http://127.0.0.1:17897"
JS="node:/usr/bin/node"

probe() {
  local name="$1"
  shift
  echo "===== $name ====="
  "$YTDLP" --proxy "$PROXY" --force-ipv4 --js-runtimes "$JS" --no-warnings "$@" -F "$URL"
  echo "exit:$?"
}

probe "android_vr" --extractor-args "youtube:player_client=android_vr"
probe "web_safari" --extractor-args "youtube:player_client=web_safari"
probe "tv" --extractor-args "youtube:player_client=tv"
probe "default"
