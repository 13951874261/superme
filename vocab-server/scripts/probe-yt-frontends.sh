#!/usr/bin/env bash
set -u
PROXY="http://127.0.0.1:17897"
ID="YoBc3zII7lg"
echo "docker: $(command -v docker || echo none)"
urls=(
  "https://pipedapi.kavin.rocks/streams/${ID}"
  "https://pipedapi.adminforge.de/streams/${ID}"
  "https://invidious.fdn.fr/api/v1/videos/${ID}"
  "https://yewtu.be/api/v1/videos/${ID}"
  "https://inv.nadeko.net/api/v1/videos/${ID}"
  "https://invidious.nerdvpn.de/api/v1/videos/${ID}"
  "https://iv.ggtyler.dev/api/v1/videos/${ID}"
  "https://invidious.privacyredirect.com/api/v1/videos/${ID}"
)
for u in "${urls[@]}"; do
  echo
  echo "GET $u"
  code=$(curl -sS --max-time 15 -o /tmp/inv.json -w "%{http_code}" -x "$PROXY" -A "Mozilla/5.0" "$u" || echo fail)
  echo "http:$code bytes:$(wc -c < /tmp/inv.json 2>/dev/null || echo 0)"
  python3 - <<'PY'
import json
try:
    d=json.load(open("/tmp/inv.json"))
except Exception as e:
    print("parse", e)
    raise SystemExit
if not isinstance(d, dict):
    print("type", type(d))
    raise SystemExit
print("err", d.get("error") or d.get("message") or "")
print("title", (d.get("title") or "")[:80])
audio = d.get("audioStreams") or []
adaptive = d.get("adaptiveFormats") or []
print("audioStreams", len(audio), "adaptiveFormats", len(adaptive))
if audio:
    a=audio[0]
    print("firstAudio", a.get("quality"), (a.get("url") or "")[:90])
if adaptive:
    aud=[x for x in adaptive if "audio" in str(x.get("type") or x.get("mimeType") or "")]
    print("adaptiveAudio", len(aud))
    if aud:
        print("firstAdaptive", (aud[0].get("url") or "")[:90])
PY
done
