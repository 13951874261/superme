const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);
const dailyPackService = require('../services/dailyPackService');

const today = dailyPackService.getPackDate();
console.log(`\n🔍 [前台拉取诊断] 今天日期: ${today}`);

const testUsers = ['lzhumy', 'lzhmy'];
const genre = 'meeting';
const cefrLevel = 'C1';
const duration = '1';

for (const userId of testUsers) {
  const userIds = [userId];
  if (userId === 'lzhmy') userIds.push('lzhumy');
  if (userId === 'lzhumy') userIds.push('lzhmy');

  // SQL 1
  let row1 = db.prepare(`
    SELECT id, user_id, quota_date, genre, cefr_level, duration, length(article) as len FROM daily_extracted_articles
    WHERE user_id IN (${userIds.map(() => '?').join(',')}) AND quota_date = ? AND genre = ? AND cefr_level = ? AND (duration = ? OR duration = ?)
    ORDER BY created_at DESC LIMIT 1
  `).get(...userIds, today, genre, cefrLevel, duration, Number(duration));
  console.log(`测试用户 [${userId}] 精确查找结果:`, row1 || 'NULL');
}

const allCount = db.prepare("SELECT count(*) as cnt FROM daily_extracted_articles").get();
console.log(`表总量 count: ${allCount.cnt}`);

const userDistinct = db.prepare("SELECT DISTINCT user_id, quota_date FROM daily_extracted_articles").all();
console.log('数据库中现存的 user_id + quota_date 组合:', userDistinct);
