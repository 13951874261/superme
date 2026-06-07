const path = require('path');
const Database = require('better-sqlite3');

const isProd = process.env.NODE_ENV === 'production' || __dirname.includes('/opt/vocab-server') || __dirname.includes('/var/www/super-agent');
const dbPath = isProd ? '/var/www/super-agent/vocab.db' : path.join(__dirname, 'vocab.db');

console.log('Connecting to database:', dbPath);
const db = new Database(dbPath);

const today = new Date().toISOString().split('T')[0];
console.log(`Today's date (UTC): ${today}`);

// 计算今日当地时间的 00:00:00 毫秒数
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayStartMs = todayStart.getTime();
console.log(`Today's start timestamp (local): ${todayStartMs} (${todayStart.toLocaleString('zh-CN')})`);

try {
  // 1. 删除今日生成的单词与短语
  const deleteWords = db.prepare("DELETE FROM vocabulary WHERE added_at >= ? AND (dict_type = 'ai_extracted' OR dict_type = 'ai_phrase')");
  const wordsResult = deleteWords.run(todayStartMs);
  console.log(`✓ 成功删除今日生成的单词和短语数量: ${wordsResult.changes}`);

  // 2. 重置今日配额记录
  const resetQuota = db.prepare("UPDATE daily_vocab_quota SET words_added = 0, phrases_added = 0 WHERE quota_date = ?");
  const quotaResult = resetQuota.run(today);
  console.log(`✓ 成功重置日期为 ${today} 的每日词汇和短语配额计数。影响行数: ${quotaResult.changes}`);

} catch (error) {
  console.error('执行数据库清空时出错:', error);
} finally {
  db.close();
  console.log('数据库连接已关闭。');
}
