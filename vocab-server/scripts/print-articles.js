const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const rows = db.prepare(`
  SELECT id, duration, article, created_at 
  FROM daily_extracted_articles 
  WHERE user_id = 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625' 
  ORDER BY created_at DESC LIMIT 5
`).all();

console.log('--- 实时长文存库记录 ---');
rows.forEach((r, idx) => {
  console.log(`\n[记录 ${idx+1}] ID: ${r.id} | 时长: ${r.duration}m`);
  console.log(`正文内容: "${r.article}"`);
});
