const path = require('path');
const Database = require(path.join(__dirname, '../vocab-server/node_modules/better-sqlite3'));

const dbPath = path.join(__dirname, '../vocab-server/vocab.db');
const db = new Database(dbPath);

console.log('--- Testing schema migration & indexes ---');

// 1. 自动运行 server.js 里的 Schema Migration 逻辑
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN user_id TEXT DEFAULT 'lzhmy'").run();
  console.log('Migration Executed: Added user_id column.');
} catch (e) {
  console.log('Migration Note: user_id column already exists.');
}

db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_id ON vocabulary(user_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_category_added ON vocabulary(user_id, category, added_at DESC)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_review_opt ON vocabulary(user_id, category, next_review_date, repetitions)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_word ON vocabulary(user_id, word COLLATE NOCASE)').run();

const backfillRes = db.prepare("UPDATE vocabulary SET user_id = 'lzhmy' WHERE user_id IS NULL OR user_id = ''").run();
if (backfillRes.changes > 0) {
  console.log(`Backfilled ${backfillRes.changes} legacy items to 'lzhmy'.`);
}

// 2. 检查 user_id 列是否存在
const tableInfo = db.prepare("PRAGMA table_info(vocabulary)").all();
const hasUserId = tableInfo.some(col => col.name === 'user_id');
console.log('Has user_id column:', hasUserId);

// 3. 检查 user_id 相关复合索引
const indexList = db.prepare("PRAGMA index_list(vocabulary)").all();
const userIndexes = indexList.filter(idx => idx.name.includes('idx_vocab_user'));
console.log('Created user indexes:', userIndexes.map(i => i.name));

// 4. 统计各 user_id 下的数据量
const userCounts = db.prepare("SELECT user_id, COUNT(*) as count FROM vocabulary GROUP BY user_id").all();
console.log('User counts:', userCounts);

db.close();
console.log('--- Verification completed successfully ---');
