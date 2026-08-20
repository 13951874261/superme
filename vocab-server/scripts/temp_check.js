const fs = require('fs');
const content = fs.readFileSync('/var/www/super-agent/vocab-server/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/daily-pack/today'"));
if (idx !== -1) {
  console.log(lines.slice(idx, idx + 40).join('\n'));
} else {
  console.log('Not found');
}
