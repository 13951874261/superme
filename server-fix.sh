sudo python3 - <<'PY'
from pathlib import Path
p = Path('/var/www/super-agent/vocab-server/server.js')
text = p.read_text(encoding='utf-8')
text = text.replace("frontendUserId || getAppUserId() || 'default-user'", "frontendUserId || 'default-user'")
text = text.replace("queryUserId || getAppUserId() || 'default-user'", "queryUserId || 'default-user'")
p.write_text(text, encoding='utf-8')
print('patched')
PY
sudo node --check /var/www/super-agent/vocab-server/server.js
sudo systemctl restart super-agent-vocab.service
sudo systemctl is-active super-agent-vocab.service
