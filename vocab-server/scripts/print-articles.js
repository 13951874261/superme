const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('--- 物理表 user_theme_prefs 全量记录 ---');
const rows = db.prepare("SELECT user_id, theme, datetime(synced_at/1000, 'unixepoch', 'localtime') as time FROM user_theme_prefs").all();
console.table(rows);
