const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('--- 准备修复老数据的复习字段 ---');

const fixStmt = db.prepare(`
  UPDATE vocabulary
  SET 
    ease_factor = 2.5,
    interval_days = 1,
    repetitions = 0
  WHERE interval_days = 0 OR ease_factor IS NULL OR ease_factor = 0
`);

const result = fixStmt.run();

console.log(`修复完成！共影响了 ${result.changes} 条老记录。这些词汇将在下次复习时遵循新的 SM-2 算法。`);
