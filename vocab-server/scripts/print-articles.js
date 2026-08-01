const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const rows = db.prepare(`
  SELECT id, user_id, quota_date, genre, cefr_level, duration, article 
  FROM daily_extracted_articles 
  ORDER BY created_at DESC LIMIT 10
`).all();

console.log('--- 数据库 daily_extracted_articles 全量落库核查 ---');
rows.forEach((r, idx) => {
  console.log(`[${idx+1}] User: "${r.user_id}" | Date: ${r.quota_date} | Genre: ${r.genre} | Level: ${r.cefr_level} | Duration: ${r.duration}`);
});
