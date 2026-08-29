#!/usr/bin/env bash
set -euo pipefail
if ! command -v warp-cli >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg
  CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ ${CODENAME} main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y cloudflare-warp
fi
sudo warp-cli --accept-tos registration new || true
sudo warp-cli --accept-tos mode proxy
    'socks5h://127.0.0.1:40000',
sleep 3
sudo warp-cli --accept-tos status || true
ss -lnt | grep 40000 || true
curl -sI --max-time 20 -x socks5://127.0.0.1:40000 https://www.youtube.com -o /dev/null -w "yt_via_warp:%{http_code} %{errormsg}\n" || true
