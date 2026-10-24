const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('\n================📦 1. 今日唤醒包与破绽包 (daily_packs) ================');
const packs = db.prepare("SELECT id, user_id, pack_date, theme, status FROM daily_packs WHERE user_id = 'lzhmy'").all();
console.table(packs);

console.log('\n================📄 2. 1分钟商业短长文正文 (daily_extracted_articles) ================');
const articles = db.prepare("SELECT genre AS 体裁, cefr_level AS 难度, duration AS 时长, length(article) as 字节数, article AS 正文 FROM daily_extracted_articles WHERE user_id = 'lzhmy' AND (duration = 1 OR duration = '1') ORDER BY genre, cefr_level").all();
console.table(articles);

console.log('\n================🎧 3. 1分钟听力音频 (daily_listen_audios) ================');
const audios = db.prepare("SELECT genre AS 体裁, cefr_level AS 难度, duration AS 时长, audio_url AS 音频路径, status AS 状态 FROM daily_listen_audios WHERE user_id = 'lzhmy' AND (duration = 1 OR duration = '1')").all();
console.table(audios);
