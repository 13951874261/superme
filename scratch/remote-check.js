const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');
const packDate = '2026-08-09';
const row = db.prepare("SELECT * FROM daily_packs WHERE user_id='lzhmy' AND pack_date=?").get(packDate);
console.log('daily_packs fields:', row ? {
  id: row.id,
  user_id: row.user_id,
  pack_date: row.pack_date,
  theme: row.theme,
  status: row.status,
  source: row.source,
  wakeup_json_length: row.wakeup_json ? row.wakeup_json.length : 0,
  flaw_vocab_json_length: row.flaw_vocab_json ? row.flaw_vocab_json.length : 0,
  input_signature: row.input_signature
} : 'null');
db.close();