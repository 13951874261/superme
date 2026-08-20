const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);
const dailyPackService = require('../services/dailyPackService');

const res = dailyPackService.upsertUserTheme(db, 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625', '商务谈判：让步与施压');
console.log('✅ upsertUserTheme 模拟落库成功:', res);

const rows = db.prepare("SELECT user_id, theme, datetime(synced_at/1000, 'unixepoch', 'localtime') as time FROM user_theme_prefs").all();
console.table(rows);
