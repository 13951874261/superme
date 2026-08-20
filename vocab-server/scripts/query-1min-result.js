const Database = require('better-sqlite3');
const path = require('path');

const targetUser = process.argv[2] || 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log(`\n================ 核验用户 [${targetUser}] 1 分钟 (duration=1) 模拟生成记录 ================`);

const articles = db.prepare(`
  SELECT id, user_id, quota_date, theme, genre, cefr_level, duration, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM daily_extracted_articles
  ORDER BY created_at DESC LIMIT 10
`).all();

console.log(`\n1. 【最新预生成长文 daily_extracted_articles】 记录数: ${articles.length}`);
console.dir(articles, { depth: null });

const audios = db.prepare(`
  SELECT id, user_id, pack_date, genre, cefr_level, duration, audio_url, status, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM daily_listen_audios
  ORDER BY created_at DESC LIMIT 10
`).all();

console.log(`\n2. 【1分钟精听盲听音频 daily_listen_audios】 记录数: ${audios.length}`);
console.dir(audios, { depth: null });

console.log('\n========================================================================================\n');
