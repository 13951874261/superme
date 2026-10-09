const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('\n================ 正在轮询等待 Dify 异步生成结果落库... ================');

let articles = [];
let audios = [];

for (let i = 0; i < 12; i++) {
  try {
    articles = db.prepare("SELECT id, user_id, theme, genre, cefr_level, duration, datetime(created_at/1000, 'unixepoch', 'localtime') as time FROM daily_extracted_articles ORDER BY created_at DESC LIMIT 10").all();
    audios = db.prepare("SELECT id, user_id, pack_date, genre, cefr_level, duration, audio_url, status FROM daily_listen_audios ORDER BY created_at DESC LIMIT 10").all();
  } catch (e) {
    console.error('SQL query error:', e.message);
  }

  if (articles.length > 0 || audios.length > 0) {
    console.log(`\n ✅ 轮询第 ${i + 1} 次捕获到已落库的长文与音频数据！`);
    break;
  }

  console.log(` -> 轮询中 (${i + 1}/12)... 等待后台流式与音档合成结束`);
  const start = Date.now();
  while (Date.now() - start < 2000) {}
}

console.log(`\n1. 【每日长文物理落库条数】: ${articles.length}`);
console.dir(articles, { depth: null });

console.log(`\n2. 【精听盲听音频落库条数】: ${audios.length}`);
console.dir(audios, { depth: null });

console.log('\n========================================================================\n');
