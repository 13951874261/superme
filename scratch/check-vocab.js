const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');
const rows = db.prepare("SELECT * FROM vocabulary WHERE user_id='default-user' ORDER BY added_at DESC LIMIT 20").all();
console.log('default-user vocab:', rows.map(r => r.word));
db.close();