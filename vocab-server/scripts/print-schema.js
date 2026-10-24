const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('\n--- daily_packs 近期记录 ---');
console.log(db.prepare("SELECT id, user_id, pack_date, theme, status FROM daily_packs ORDER BY created_at DESC LIMIT 10").all());

console.log('\n--- daily_listen_articles 近期记录 ---');
console.log(db.prepare("SELECT id, user_id, pack_date, theme, genre, cefr_level, duration, status FROM daily_listen_articles ORDER BY created_at DESC LIMIT 10").all());
