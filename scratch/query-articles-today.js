const Database = require('/var/www/super-agent/vocab-server/node_modules/better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

const date = '2026-08-09';
const user = 'lzhmy';

console.log('--- daily_listen_articles ---');
console.log(db.prepare("SELECT * FROM daily_listen_articles WHERE pack_date = ? AND user_id = ?").all(date, user));

console.log('--- daily_listen_audios ---');
console.log(db.prepare("SELECT * FROM daily_listen_audios WHERE pack_date = ? AND user_id = ?").all(date, user));

console.log('--- daily_extracted_articles ---');
console.log(db.prepare("SELECT * FROM daily_extracted_articles WHERE quota_date = ? AND user_id = ?").all(date, user));

db.close();
