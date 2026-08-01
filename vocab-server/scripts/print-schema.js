const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('\n--- daily_packs 字段列表 ---');
console.log(db.prepare("PRAGMA table_info(daily_packs)").all());
