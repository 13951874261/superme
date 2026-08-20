const Database = require('better-sqlite3');
const path = require('path');

const targetUser = process.argv[2] || 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const targetDate = process.argv[3] || '2026-08-01';

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log(`\n================ 核验用户 [${targetUser}] 统计数据 ================`);

const packs = db.prepare(`
  SELECT id, user_id, pack_date, theme, status, source, datetime(created_at/1000, 'unixepoch', 'localtime') as time 
  FROM daily_packs 
  WHERE user_id = ? AND pack_date = ?
`).all(targetUser, targetDate);

console.log(`\n1. 【每日唤醒/破绽包 daily_packs】 记录数: ${packs.length}`);
console.dir(packs, { depth: null });

const articles = db.prepare(`
  SELECT id, user_id, quota_date, theme, genre, cefr_level, duration, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM daily_extracted_articles
  WHERE user_id = ? AND quota_date = ?
`).all(targetUser, targetDate);

console.log(`\n2. 【预生成长文 daily_extracted_articles】 记录数: ${articles.length}`);
if (articles.length > 0) {
  console.log('部分预生成文章样例:', articles.slice(0, 3));
}

console.log('\n========================================================================\n');
