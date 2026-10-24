const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('=============== 开始为 SQLite 执行结构迁移 ===============');

try {
  db.prepare("ALTER TABLE daily_extracted_articles ADD COLUMN duration TEXT DEFAULT '25'").run();
  console.log(' ✅ 已成功添加 duration 列');
} catch (e) {
  console.log(' ℹ️ duration 列状态:', e.message);
}

try {
  db.prepare("ALTER TABLE daily_extracted_articles ADD COLUMN input_signature TEXT DEFAULT ''").run();
  console.log(' ✅ 已成功添加 input_signature 列');
} catch (e) {
  console.log(' ℹ️ input_signature 列状态:', e.message);
}

console.log('=============== 迁移操作完成 ===============\n');
