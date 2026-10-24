const Database = require('better-sqlite3');
const path = require('path');

// 接收命令行参数：node locate-data.js [userId] [duration] [genre] [cefrLevel]
const args = process.argv.slice(2);
const targetUser = args[0] || 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const durationArg = args[1] || '1';
const genreArg = args[2] || 'meeting';
const cefrArg = args[3] || 'B1';

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log(`\n🔍 [数据定位工具] 正在检索 用户: ${targetUser} | 时长: ${durationArg}m | 体裁: ${genreArg} | 难度: ${cefrArg}`);
console.log(`-----------------------------------------------------------------------------------------`);

// 1. 查询 每日唤醒与破绽表 (daily_packs)
const pack = db.prepare(`
  SELECT id, pack_date, theme, status, datetime(created_at/1000, 'unixepoch', 'localtime') as created_time 
  FROM daily_packs 
  WHERE user_id = ? 
  ORDER BY created_at DESC LIMIT 1
`).get(targetUser);

console.log('\n📦 1. 唤醒与破绽包 (daily_packs):');
if (pack) {
  console.log(`   [ID]: ${pack.id}`);
  console.log(`   [日期]: ${pack.pack_date} | [主题]: ${pack.theme} | [状态]: ${pack.status} | [生成时间]: ${pack.created_time}`);
} else {
  console.log('   ⚠️ 未查到该用户的 daily_packs 记录');
}

// 2. 查询 长文持久化主表 (daily_extracted_articles)
const article = db.prepare(`
  SELECT id, quota_date, theme, genre, cefr_level, duration, length(article) as char_count, 
         datetime(created_at/1000, 'unixepoch', 'localtime') as created_time, article 
  FROM daily_extracted_articles 
  WHERE user_id = ? AND (duration = ? OR duration = ?) AND genre = ? AND cefr_level = ?
  ORDER BY created_at DESC LIMIT 1
`).get(targetUser, durationArg, Number(durationArg), genreArg, cefrArg);

console.log('\n📄 2. 1分钟长文主表 (daily_extracted_articles):');
if (article) {
  const wordCount = article.article ? article.article.trim().split(/\s+/).length : 0;
  console.log(`   [ID]: ${article.id}`);
  console.log(`   [日期]: ${article.quota_date} | [体裁/难度]: ${article.genre}/${article.cefr_level} | [时长]: ${article.duration}m`);
  console.log(`   [字数]: ${wordCount} 词 | [字符数]: ${article.char_count} 字节 | [生成时间]: ${article.created_time}`);
  console.log(`   [正文前100字]: "${article.article.substring(0, 100).replace(/\n/g, ' ')}..."`);
} else {
  console.log(`   ⚠️ 未查到符合条件 (duration=${durationArg}, genre=${genreArg}, cefr=${cefrArg}) 的长文记录`);
}

// 3. 查询 精听音频合成表 (daily_listen_audios)
const audio = db.prepare(`
  SELECT id, pack_date, theme, genre, cefr_level, duration, audio_url, status, 
         datetime(created_at/1000, 'unixepoch', 'localtime') as created_time 
  FROM daily_listen_audios 
  WHERE user_id = ? AND (duration = ? OR duration = ?)
  ORDER BY created_at DESC LIMIT 1
`).get(targetUser, durationArg, Number(durationArg));

console.log('\n🎧 3. 精听音频表 (daily_listen_audios):');
if (audio) {
  console.log(`   [ID]: ${audio.id}`);
  console.log(`   [日期]: ${audio.pack_date} | [时长]: ${audio.duration}m | [状态]: ${audio.status} | [生成时间]: ${audio.created_time}`);
  console.log(`   [音频文件URL]: ${audio.audio_url}`);
} else {
  console.log('   ⚠️ 未查到对应的音频记录');
}

console.log(`\n-----------------------------------------------------------------------------------------\n`);
