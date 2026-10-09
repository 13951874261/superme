#!/usr/bin/env bash
set -Eeuo pipefail

web=/var/www/super-agent
api=$web/vocab-server
release_base=/var/backups/super-agent/releases
staged=/tmp/book-light-release
stamp=$(date +%Y%m%d-%H%M%S)
release=$release_base/light-$stamp
candidate=/tmp/super-agent-light-$stamp
env_file=/etc/super-agent/vocab.env
env_candidate=/tmp/vocab.env.candidate
switched=0

rollback() {
  status=$?
  if (( switched )); then
    sudo systemctl stop super-agent-vocab.service || true
    test -d "$release/backend" && { rm -rf "$api"; cp -a "$release/backend" "$api"; }
    test -d "$release/dist.previous" && { rm -rf "$web/dist"; cp -a "$release/dist.previous" "$web/dist"; }
    test -f "$release/vocab.env.previous" && sudo install -m 0600 "$release/vocab.env.previous" "$env_file"
    sudo systemctl start super-agent-vocab.service || true
  fi
  rm -rf "$candidate"
  sudo rm -f "$env_candidate"
  exit "$status"
}
trap rollback ERR

if [[ ${1:-} == --self-check ]]; then
  grep -q 'vocab.env.candidate' "$0"
  grep -q 'install -m 0600' "$0"
  grep -q 'BOOK_MVP_PROFILE=light' "$0"
  grep -q 'BOOK_OCR_ENABLED=false' "$0"
  grep -q 'systemctl show -p MainPID' "$0"
  grep -q '/proc/$pid/environ' "$0"
  grep -q 'test -d "$release/backend"' "$0"
  grep -q 'test -f "$release/vocab.env.previous"' "$0"
  echo SELF_CHECK_OK
  exit 0
fi

test -d "$staged/vocab-server"
test -d "$staged/dist"
sudo mkdir -p "$release/backend"
sudo chown -R ubuntu:ubuntu "$release"
test -d "$release"
test -w "$release"
cp -a "$api/." "$release/backend/"
cp -a "$web/dist" "$release/dist.previous"
sudo cp "$env_file" "$release/vocab.env.previous"
test -d "$release/backend"
test -d "$release/dist.previous"
test -f "$release/vocab.env.previous"
test -s "$release/vocab.env.previous"

mkdir -p "$candidate"
cp -a "$api" "$candidate/vocab-server"
cp -a "$staged/vocab-server/." "$candidate/vocab-server/"
cp -a "$staged/dist" "$candidate/dist"

sudo cp "$env_file" "$env_candidate"
sudo sed -i '/^BOOK_MVP_PROFILE=/d;/^BOOK_OCR_ENABLED=/d;/^BOOK_MVP_SKIP_HUMAN_GATE=/d;/^BOOK_MVP_HUMAN_GATE_AUTHORIZED_AT=/d;/^BOOK_MVP_HUMAN_GATE_REASON=/d' "$env_candidate"
printf '%s\n' \
  'BOOK_MVP_PROFILE=light' \
  'BOOK_OCR_ENABLED=false' \
  'BOOK_MVP_SKIP_HUMAN_GATE=true' \
  'BOOK_MVP_HUMAN_GATE_AUTHORIZED_AT=2026-09-07T14:22:00+08:00' \
  'BOOK_MVP_HUMAN_GATE_REASON=用户明确授权轻量生产部署跳过人工Gate不代表评审完成' | sudo tee -a "$env_candidate" >/dev/null
sudo grep -q '^BOOK_MVP_PROFILE=light$' "$env_candidate"
sudo grep -q '^BOOK_OCR_ENABLED=false$' "$env_candidate"
sudo grep -q '^BOOK_MVP_SKIP_HUMAN_GATE=true$' "$env_candidate"
sudo install -m 0600 "$env_candidate" "$env_file"
sudo mkdir -p /var/lib/super-agent
sudo chown ubuntu:ubuntu /var/lib/super-agent
test -d /var/lib/super-agent
test -w /var/lib/super-agent
sudo grep -q '^BOOK_MVP_PROFILE=light$' "$env_file"
sudo grep -q '^BOOK_OCR_ENABLED=false$' "$env_file"

sudo systemctl stop super-agent-vocab.service
mv "$api" "$candidate/backend.old"
mv "$candidate/vocab-server" "$api"
mv "$web/dist" "$candidate/dist.old"
mv "$candidate/dist" "$web/dist"
switched=1
sudo systemctl start super-agent-vocab.service

healthy=0
for _ in 1 2 3 4 5 6 7 8; do
  if curl -fsS --max-time 3 http://127.0.0.1:3001/api/vocab/health >/dev/null; then healthy=1; break; fi
  sleep 1
done
test "$healthy" = 1
pid=$(systemctl show -p MainPID --value super-agent-vocab.service)
test "$pid" -gt 1
sudo tr '\0' '\n' < "/proc/$pid/environ" | grep -q '^BOOK_MVP_PROFILE=light$'
sudo tr '\0' '\n' < "/proc/$pid/environ" | grep -q '^BOOK_OCR_ENABLED=false$'
sudo nginx -t
sudo systemctl reload nginx
rm -rf "$candidate" "$staged"
sudo rm -f "$env_candidate"
trap - ERR
echo "BOOK_LIGHT_DEPLOYED release=$release profile=loaded ocr=disabled"
