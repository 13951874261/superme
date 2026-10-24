const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');
const row = db.prepare("SELECT wakeup_json FROM daily_packs WHERE user_id='default-user' AND pack_date='2026-08-09'").get();
console.log(row ? JSON.parse(row.wakeup_json).vocab.map(v => v.word) : 'null');
db.close();