const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('--- 物理表 user_theme_prefs 全量查验 ---');
try {
  const prefs = db.prepare('SELECT * FROM user_theme_prefs').all();
  console.log(prefs);
} catch (e) {
  console.error(e.message);
}

console.log('\n--- 物理表 daily_packs 当天记录 ---');
try {
  const packs = db.prepare('SELECT id, user_id, pack_date, theme, status FROM daily_packs WHERE pack_date = "2026-08-02"').all();
  console.log(packs);
} catch (e) {
  console.error(e.message);
}
