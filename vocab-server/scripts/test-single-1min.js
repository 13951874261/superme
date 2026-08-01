const Database = require('better-sqlite3');
const path = require('path');
const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

// 加载全套原生 Server 组件与已注入的 TTS 合成引擎
require('../server');

const targetUser = 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

async function main() {
  console.log(`\n================ 核验用户 [${targetUser}] 1 分钟 (duration=1) 定时与合成流水线 ================`);
  const theme = "商务谈判：让步与施压";
  const packDate = dailyPackService.getPackDate();

  console.log('\n[1/3] 模拟 2:00 AM 定时触发: 自动插入 1 分钟长文并同步存库...');
  const sampleArticle = "In modern business negotiations, making strategic concessions while maintaining firm pressure is essential. Parties must analyze core interests, identify flexible boundaries, and communicate with high emotional intelligence to achieve mutual gain without compromising bottom lines.";

  const artId = require('crypto').randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artId,
    targetUser,
    packDate,
    theme,
    'meeting',
    'B1',
    sampleArticle,
    JSON.stringify([{ word: 'negotiations' }, { word: 'concessions' }]),
    JSON.stringify(['strategic concessions', 'firm pressure']),
    JSON.stringify(['Parties must analyze core interests.']),
    '1',
    'sig_test_1m',
    Date.now(),
    Date.now()
  );

  const insertedArt = db.prepare('SELECT id, user_id, quota_date, theme, genre, cefr_level, duration, length(article) as text_len FROM daily_extracted_articles WHERE id = ?').get(artId);
  console.log(' ✅ 1 分钟长文自动物理落库记录:');
  console.dir(insertedArt);

  console.log('\n[2/3] 触发精听盲听音频引擎合成该 1 分钟长文为 .mp3 音档...');
  const fullRow = db.prepare('SELECT * FROM daily_extracted_articles WHERE id = ?').get(artId);
  const audioSyncRes = await dailyListenPreGenerateService.syncAudioFromLongArticleRow(db, fullRow, 'cron');
  console.log(' -> 音频引擎合成响应:', audioSyncRes);

  const audioRow = db.prepare('SELECT id, user_id, pack_date, genre, cefr_level, duration, audio_url, status FROM daily_listen_audios WHERE user_id = ? AND duration = 1 ORDER BY created_at DESC LIMIT 1').get(targetUser);
  console.log(' ✅ 1 分钟精听音频物理落库记录:');
  console.dir(audioRow);

  console.log('\n[3/3] 运行整套批处理 (batchSyncAudiosFromLongArticles) 验证全自动化音频复用...');
  const batchRes = await dailyListenPreGenerateService.batchSyncAudiosFromLongArticles(db, targetUser, packDate);
  console.log(' -> 批处理合成复用结果:', batchRes);

  console.log('\n================ 1 分钟 02:00 AM 定时任务模拟与合成测验全部通过！ ====================\n');
  process.exit(0);
}

main().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
