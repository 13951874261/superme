const Database = require('/var/www/super-agent/vocab-server/node_modules/better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

const date = '2026-08-08';
const users = ['lzhmy', 'lzhumy'];

console.log('--- daily_packs for 2026-08-08 ---');
console.log(db.prepare("SELECT id, user_id, pack_date, theme, status, input_signature FROM daily_packs WHERE pack_date = ? AND user_id IN (?, ?)").all(date, ...users));

console.log('--- daily_listen_articles for 2026-08-08 ---');
console.log(db.prepare("SELECT user_id, theme, genre, cefr_level, duration, status, input_signature FROM daily_listen_articles WHERE pack_date = ? AND user_id IN (?, ?)").all(date, ...users));

console.log('--- daily_listen_audios for 2026-08-08 ---');
console.log(db.prepare("SELECT user_id, theme, genre, cefr_level, duration, status, input_signature FROM daily_listen_audios WHERE pack_date = ? AND user_id IN (?, ?)").all(date, ...users));

db.close();
