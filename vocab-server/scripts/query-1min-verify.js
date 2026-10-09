const Database = require('better-sqlite3');
const path = require('path');

const targetUser = 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log(`\n================ 后台物理数据库落库精确核查报告 [用户: ${targetUser}] ================`);

// 1. 检查 daily_packs (唤醒包与破绽词汇包)
const wakeupRow = db.prepare("SELECT id, user_id, pack_date, theme, status, created_at FROM daily_packs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(targetUser);
console.log('\n【1/3 每日唤醒与破绽包 (daily_packs)】:');
if (wakeupRow) {
  console.log(` ✅ 状态: ${wakeupRow.status} | 编号: ${wakeupRow.id} | 日期: ${wakeupRow.pack_date} | 主题: ${wakeupRow.theme}`);
} else {
  console.log(' ❌ 未查到 daily_packs 记录');
}

// 2. 检查 daily_extracted_articles & daily_listen_articles (1分钟长文)
const articleRow = db.prepare("SELECT id, user_id, quota_date, theme, genre, cefr_level, duration, length(article) as char_len, article FROM daily_extracted_articles WHERE user_id = ? AND (duration = '1' OR duration = 1) ORDER BY created_at DESC LIMIT 1").get(targetUser);
console.log('\n【2/3 1分钟短长文表 (daily_extracted_articles)】:');
if (articleRow) {
  const wordCount = articleRow.article ? articleRow.article.trim().split(/\s+/).length : 0;
  console.log(` ✅ 状态: 物理落库 | 时长: ${articleRow.duration}m | 词数: ${wordCount} 英文词 (规则: 80-120词) | 体裁: ${articleRow.genre}/${articleRow.cefr_level}`);
  console.log(` 📝 文章内容摘要: "${articleRow.article.substring(0, 90)}..."`);
} else {
  console.log(' ❌ 未查到 1 分钟长文物理记录');
}

// 3. 检查 daily_listen_audios (1分钟精听音频)
const audioRow = db.prepare("SELECT id, user_id, pack_date, genre, cefr_level, duration, audio_url, status FROM daily_listen_audios WHERE user_id = ? AND (duration = 1 OR duration = '1') ORDER BY created_at DESC LIMIT 1").get(targetUser);
console.log('\n【3/3 1分钟精听音档表 (daily_listen_audios)】:');
if (audioRow) {
  console.log(` ✅ 状态: ${audioRow.status} | 时长: ${audioRow.duration}m | mp3链接: ${audioRow.audio_url}`);
} else {
  console.log(' ❌ 未查到 1 分钟精听音频物理记录');
}

console.log('\n========================================================================================\n');
