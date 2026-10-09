const fs = require('fs');
const path = require('path');

const MAX_DB_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB 硬盘容量警戒阈值
const TARGET_CLEAN_BYTES = 800 * 1024 * 1024;  // 清理回落目标线 (800MB)

/**
 * 获取 SQLite 数据库及其 WAL/SHM 文件占据的总物理体积 (Byte)
 */
function getTotalDbSizeBytes(dbPath) {
  let totalSize = 0;
  const filesToCheck = [
    dbPath,
    `${dbPath}-wal`,
    `${dbPath}-shm`
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      } catch (err) {
        console.warn(`[Content Cleanup] Unable to stat file ${filePath}:`, err.message);
      }
    }
  }
  return totalSize;
}

/**
 * 触发数据库 1G 体积自动监测、LRU 按 updated_at 裁剪与物理空闲页释放
 */
function checkAndAutoCleanDatabase(db, dbPath) {
  if (!db || !dbPath) return;

  try {
    const totalSizeBytes = getTotalDbSizeBytes(dbPath);
    const sizeInMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    if (totalSizeBytes < MAX_DB_SIZE_BYTES) {
      console.log(`[Content Cleanup Check] Database file size: ${sizeInMB} MB (Safe limit: 1024 MB). Skipping cleanup.`);
      return;
    }

    console.warn(`[Content Cleanup Alert] Database size (${sizeInMB} MB) EXCEEDS 1GB threshold! Initiating LRU Auto Cleanup...`);

    // 启用增量 Auto Vacuum 设置
    try {
      db.prepare('PRAGMA auto_vacuum = INCREMENTAL;').run();
    } catch {}

    // 1. 优先清理 7 天前最老的长文生成缓存 (按照 updated_at ASC)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const deleteArticlesStmt = db.prepare(`
      DELETE FROM daily_extracted_articles 
      WHERE updated_at < ?
      ORDER BY updated_at ASC LIMIT 2000
    `);
    const articleResult = deleteArticlesStmt.run(sevenDaysAgo);
    console.log(`[Content Cleanup LRU] Cleared ${articleResult.changes} expired long articles older than 7 days.`);

    // 2. 清理最早的语音生成临时记录或语料词汇历史缓存
    try {
      const deleteHistoryStmt = db.prepare(`
        DELETE FROM generation_history 
        WHERE generated_at < ?
        ORDER BY generated_at ASC LIMIT 3000
      `);
      const historyResult = deleteHistoryStmt.run(sevenDaysAgo * 1000);
      console.log(`[Content Cleanup LRU] Cleared ${historyResult.changes} generation history records older than 7 days.`);
    } catch {}

    // 3. 执行物理 Incremental Vacuum 彻底归还磁盘物理页
    try {
      console.log('[Content Cleanup Vacuum] Executing PRAGMA incremental_vacuum to return free pages to disk...');
      db.prepare('PRAGMA incremental_vacuum(2000);').run();
    } catch (vacErr) {
      console.warn('[Content Cleanup Vacuum Warning]:', vacErr.message);
    }

    const newSizeBytes = getTotalDbSizeBytes(dbPath);
    const newSizeInMB = (newSizeBytes / (1024 * 1024)).toFixed(2);
    console.log(`[Content Cleanup Success] Cleanup finished. Database size optimized from ${sizeInMB} MB to ${newSizeInMB} MB.`);

  } catch (error) {
    console.error('[Content Cleanup Error] Failed to execute database cleanup:', error);
  }
}

module.exports = {
  getTotalDbSizeBytes,
  checkAndAutoCleanDatabase,
};
