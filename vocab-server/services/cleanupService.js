const fs = require('fs');
const path = require('path');

const MAX_DB_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB 阈值
const RETENTION_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30天

/**
 * 检查并清理数据库超大文件，带 1GB 监控、VACUUM 物理释放与审计日志
 * @param {import('better-sqlite3').Database} db 数据库对象
 * @param {string} [dbPath] 数据库文件绝对路径（若为空则尝试通过 db.name 获取）
 */
function checkAndCleanDatabase(db, dbPath) {
  if (!db) return { cleaned: false, reason: 'db instance is required' };
  
  const targetPath = dbPath || db.name;
  if (!targetPath || targetPath === ':memory:') {
    return { cleaned: false, reason: 'invalid or memory db path' };
  }

  try {
    if (!fs.existsSync(targetPath)) {
      return { cleaned: false, reason: `db file not found: ${targetPath}` };
    }

    const stats = fs.statSync(targetPath);
    const sizeInBytes = stats.size;
    const beforeMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    if (sizeInBytes <= MAX_DB_SIZE_BYTES) {
      return {
        cleaned: false,
        sizeMB: beforeMB,
        message: `Database size (${beforeMB} MB) is within limits (<= 1GB). No cleanup needed.`
      };
    }

    console.log(`[Cleanup Audit] ⚠️ Database size (${beforeMB} MB) exceeds 1GB threshold. Initiating auto-cleanup...`);

    const limitTime = Date.now() - RETENTION_DAYS_MS;
    
    // 1. 删除 30 天前的历史长文与每日包
    const resArticles = db.prepare('DELETE FROM daily_extracted_articles WHERE updated_at < ? OR created_at < ?').run(limitTime, limitTime);
    const resPacks = db.prepare('DELETE FROM daily_packs WHERE updated_at < ? OR created_at < ?').run(limitTime, limitTime);

    let deletedArticles = resArticles.changes || 0;
    let deletedPacks = resPacks.changes || 0;

    // 2. 兜底保护：若删除30天前数据后仍然可能记录过多，强制仅保留最新的 100 条
    const currentArticlesCount = db.prepare('SELECT COUNT(*) as count FROM daily_extracted_articles').get()?.count || 0;
    if (currentArticlesCount > 100) {
      const extraRes = db.prepare(`
        DELETE FROM daily_extracted_articles 
        WHERE id NOT IN (
          SELECT id FROM daily_extracted_articles ORDER BY updated_at DESC LIMIT 100
        )
      `).run();
      deletedArticles += (extraRes.changes || 0);
    }

    const currentPacksCount = db.prepare('SELECT COUNT(*) as count FROM daily_packs').get()?.count || 0;
    if (currentPacksCount > 100) {
      const extraRes = db.prepare(`
        DELETE FROM daily_packs 
        WHERE id NOT IN (
          SELECT id FROM daily_packs ORDER BY updated_at DESC LIMIT 100
        )
      `).run();
      deletedPacks += (extraRes.changes || 0);
    }

    // 3. 清理 7 天前的精听盲听物理音频文件 (.mp3) 与离线长文文本 (.txt)
    cleanPhysicalAudioFiles(db);

    // 4. 执行 VACUUM 真正释放 SQLite 磁盘物理文件空间
    console.log('[Cleanup Audit] Reclaiming disk space with VACUUM...');
    db.exec('VACUUM');

    const afterStats = fs.statSync(targetPath);
    const afterMB = (afterStats.size / (1024 * 1024)).toFixed(2);

    const auditLog = `[Cleanup Audit] ${new Date().toISOString()} | Size Before: ${beforeMB} MB -> After: ${afterMB} MB | Deleted: ${deletedArticles} articles, ${deletedPacks} daily packs.`;
    console.log(auditLog);

    return {
      cleaned: true,
      beforeMB,
      afterMB,
      deletedArticles,
      deletedPacks,
      message: auditLog
    };
  } catch (err) {
    console.error('[Cleanup Audit] Error during database cleanup:', err.message);
    return { cleaned: false, error: err.message };
  }
}

/**
 * 清理 7 天前的精听盲听物理音频 (.mp3) 与离线文本文件
 */
function cleanPhysicalAudioFiles(db) {
  try {
    const audioRoot = path.join(__dirname, '../public/daily_listen_audio');
    const limitTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    if (db) {
      const oldAudios = db.prepare('SELECT id, audio_path FROM daily_listen_audios WHERE updated_at < ? OR created_at < ?').all(limitTime, limitTime);
      let removedFiles = 0;
      for (const a of oldAudios) {
        if (a.audio_path && fs.existsSync(a.audio_path)) {
          try {
            fs.unlinkSync(a.audio_path);
            removedFiles++;
          } catch {}
        }
      }
      db.prepare('DELETE FROM daily_listen_audios WHERE updated_at < ? OR created_at < ?').run(limitTime, limitTime);
      db.prepare('DELETE FROM daily_listen_articles WHERE updated_at < ? OR created_at < ?').run(limitTime, limitTime);
      console.log(`[Cleanup Audit] Cleaned ${removedFiles} physical audio (.mp3) entries older than 7 days.`);
    }
  } catch (err) {
    console.warn('[Cleanup Audit] Physical audio cleanup warning:', err.message);
  }
}

module.exports = {
  checkAndCleanDatabase,
  cleanPhysicalAudioFiles,
  MAX_DB_SIZE_BYTES
};
