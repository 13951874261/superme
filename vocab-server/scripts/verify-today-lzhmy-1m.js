const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

function getPackDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const targetUser = 'lzhmy';
const today = getPackDate();

console.log(`\n================🔍 精确核查 [用户: ${targetUser}] 日期: [${today}] 时长: [1分钟] 生成状态 ================`);

// 1. 检查今日唤醒包与破绽词包
const packs = db.prepare("SELECT id, user_id, pack_date, theme, status FROM daily_packs WHERE user_id = ? AND pack_date = ?").all(targetUser, today);
console.log(`\n📦 1. 今日唤醒包与破绽词汇包 (daily_packs):`);
if (packs.length > 0) {
  console.table(packs);
  console.log(`✅ [唤醒包+破绽词包] 结论: 已成功生成 ${packs.length} 条记录 (状态: ${packs[0].status})`);
} else {
  console.log(`❌ [唤醒包+破绽词包] 结论: 今日未找到用户 ${targetUser} 的记录`);
}

// 2. 检查 1 分钟短长文正文 (7体裁 * 4难度 = 16条或28条)
const articles = db.prepare(`
  SELECT genre AS 体裁, cefr_level AS 难度, duration AS 时长, length(article) as 正文字节数, article AS 正文首句
  FROM daily_extracted_articles
  WHERE user_id = ? AND quota_date = ? AND (duration = 1 OR duration = '1')
  ORDER BY genre, cefr_level
`).all(targetUser, today);

console.log(`\n📄 2. 1分钟商业短长文正文主表 (daily_extracted_articles):`);
if (articles.length > 0) {
  console.table(articles.map(a => ({
    ...a,
    正文首句: a.正文首句.slice(0, 60) + '...'
  })));
  console.log(`✅ [1分钟短长文正文] 结论: 已成功物理生成并落库共 ${articles.length} 条 1分钟短长文记录`);
} else {
  console.log(`❌ [1分钟短长文正文] 结论: 今日未找到 1分钟短长文记录`);
}

// 3. 检查 1 分钟 MP3 听力音频
const audios = db.prepare(`
  SELECT genre AS 体裁, cefr_level AS 难度, duration AS 时长, audio_url AS 音频路径, status AS 状态
  FROM daily_listen_audios
  WHERE user_id = ? AND pack_date = ? AND (duration = 1 OR duration = '1')
  ORDER BY genre, cefr_level
`).all(targetUser, today);

console.log(`\n🎧 3. 1分钟精听 MP3 音频表 (daily_listen_audios):`);
if (audios.length > 0) {
  console.table(audios);
  console.log(`✅ [1分钟听力音频] 结论: 已成功物理生成并落库共 ${audios.length} 条 1分钟 MP3 音频文件`);
} else {
  console.log(`❌ [1分钟听力音频] 结论: 今日未找到 1分钟音频记录`);
}

console.log('\n===============================================================================================\n');
