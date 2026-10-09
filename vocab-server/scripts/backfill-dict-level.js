/**
 * backfill-dict-level.js
 * 词典覆盖率历史数据 level 字段分块回填脚本 (VOCAB-Q-PERF-01)
 *
 * 采用分批查询与事务批量更新，避免一次性加载全部 payload 导致内存溢出。
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const isProd = process.env.NODE_ENV === 'production' || __dirname.includes('/opt/vocab-server');
const defaultDbPath = isProd ? '/var/www/super-agent/vocab.db' : path.join(__dirname, '../vocab.db');
const dbPath = process.env.DB_PATH || process.argv[2] || defaultDbPath;

console.log(`[Backfill Level] 连接数据库: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`[Backfill Level] 数据库文件不存在: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 1. 确保 level 字段存在
try {
  db.prepare('ALTER TABLE dict_query_log ADD COLUMN level TEXT').run();
  console.log('[Backfill Level] 新增 level 列成功。');
} catch (e) {
  // 列已存在，忽略
}

// 2. 确保 (is_success, level) 索引存在
try {
  db.prepare('CREATE INDEX IF NOT EXISTS idx_dict_log_level ON dict_query_log(is_success, level)').run();
  console.log('[Backfill Level] 索引 idx_dict_log_level 准备就绪。');
} catch (e) {
  console.warn('[Backfill Level] 创建索引跳过:', e.message);
}

// 3. 统计待处理记录数
const pendingCount = db.prepare('SELECT COUNT(*) as count FROM dict_query_log WHERE is_success = 1 AND level IS NULL').get().count;
console.log(`[Backfill Level] 待回填成功记录总数: ${pendingCount}`);

if (pendingCount === 0) {
  console.log('[Backfill Level] 没有需要回填的数据，脚本结束。');
  process.exit(0);
}

const BATCH_SIZE = 1000;
let processed = 0;
let updatedCount = 0;

const selectStmt = db.prepare(`
  SELECT id, response_payload
  FROM dict_query_log
  WHERE is_success = 1 AND level IS NULL
  LIMIT ?
`);

const updateStmt = db.prepare(`
  UPDATE dict_query_log
  SET level = ?
  WHERE id = ?
`);

const updateBatch = db.transaction((rows) => {
  for (const row of rows) {
    let level = '';
    if (row.response_payload) {
      try {
        const parsed = JSON.parse(row.response_payload);
        const raw = parsed?.payload?.level || parsed?.level;
        if (typeof raw === 'string' && raw.trim()) {
          level = raw.trim();
        }
      } catch (e) {
        // payload parse 失败，设为空字符串
        level = '';
      }
    }
    updateStmt.run(level, row.id);
    updatedCount++;
  }
});

const startTime = Date.now();

while (true) {
  const rows = selectStmt.all(BATCH_SIZE);
  if (!rows || rows.length === 0) {
    break;
  }

  updateBatch(rows);
  processed += rows.length;

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const percent = ((processed / pendingCount) * 100).toFixed(1);
  console.log(`[Backfill Level] 进度: ${processed}/${pendingCount} (${percent}%) | 耗时: ${elapsedSec}s`);
}

console.log(`[Backfill Level] 回填完成！共处理 ${processed} 行，耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
