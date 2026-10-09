const Database = require('/var/www/super-agent/vocab-server/node_modules/better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

const date = '2026-08-09';
const user = 'lzhmy';

db.prepare("DELETE FROM daily_packs WHERE pack_date = ? AND user_id = ?").run(date, user);
db.prepare("DELETE FROM daily_listen_articles WHERE pack_date = ? AND user_id = ?").run(date, user);
db.prepare("DELETE FROM daily_listen_audios WHERE pack_date = ? AND user_id = ?").run(date, user);
db.prepare("DELETE FROM daily_extracted_articles WHERE quota_date = ? AND user_id = ?").run(date, user);
console.log('Today\'s records cleared for user', user);
db.close();
