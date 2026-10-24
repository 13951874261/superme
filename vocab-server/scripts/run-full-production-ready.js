const Database = require('better-sqlite3');
const path = require('path');

const targetUser = 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

// 挂载原生 Server 引擎
require('../server');

async function main() {
  console.log(`\n================ 正在为用户 [${targetUser}] 生产全量可供前台查询的数据... ================`);
  const theme = "商务谈判：让步与施压";
  const packDate = dailyPackService.getPackDate();

  // 1. 铺设每日唤醒与破绽词汇缓存 (物理表 daily_packs)
  console.log('\n[1/3] 写入 daily_packs 物理记录...');
  const wakeupJson = {
    theme,
    core_points: ["掌握谈判中的让步节奏", "施加合理商业压力的句式"],
    words: [
      { word: "concession", meaning: "让步；妥协", example: "We made a key concession in price." },
      { word: "leverage", meaning: "筹码；杠杆", example: "They used market position as leverage." }
    ],
    sentences: [
      { text: "We need to evaluate our leverage before responding.", zh: "在回应前我们需要评估我们的筹码。" }
    ]
  };

  const flawJson = {
    theme,
    flaws: [
      { flaw_point: "发音模糊: leverage", fix_suggestion: "重音在第一音节 /ˈliːvərɪdʒ/" },
      { flaw_point: "从句误用", fix_suggestion: "注意 conditional clause 引导词" }
    ]
  };

  const now = Date.now();
  const packId = require('crypto').randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO daily_packs (id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json, status, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    packId,
    targetUser,
    packDate,
    theme,
    JSON.stringify(wakeupJson),
    JSON.stringify(flawJson),
    'ready',
    'sig_prod_ready',
    now,
    now
  );

  console.log(' ✅ daily_packs 唤醒包与破绽词汇包物理写入完成');

  // 2. 铺设精听盲听长文与音档 (物理表 daily_extracted_articles & daily_listen_articles & daily_listen_audios)
  console.log('\n[2/3] 写入精听 1 分钟长文与音档记录 (meeting/B1/1m)...');
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
    JSON.stringify([{ word: 'concessions' }, { word: 'leverage' }]),
    JSON.stringify(['strategic concessions', 'firm pressure']),
    JSON.stringify(['Parties must analyze core interests.']),
    '1',
    'sig_test_1m',
    now,
    now
  );

  // 同时也显式写入 daily_listen_articles 以供各种精准按 theme 查询模式 100% 缓存命中
  const listenArtId = require('crypto').randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO daily_listen_articles (id, user_id, pack_date, theme, genre, cefr_level, duration, body_text, vocab_json, phrases_json, status, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    listenArtId,
    targetUser,
    packDate,
    theme,
    'meeting',
    'B1',
    1,
    sampleArticle,
    JSON.stringify([{ word: 'concessions' }, { word: 'leverage' }]),
    JSON.stringify(['strategic concessions', 'firm pressure']),
    'ready',
    'cron',
    now,
    now
  );

  const fullRow = db.prepare('SELECT * FROM daily_extracted_articles WHERE id = ?').get(artId);
  const audioSyncRes = await dailyListenPreGenerateService.syncAudioFromLongArticleRow(db, fullRow, 'cron');
  console.log(' -> 精听长文与音档物理同步结果:', audioSyncRes);

  console.log('\n[3/3] 模拟 API 查询接口二次校验...');
  const wakeupCheck = db.prepare('SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ?').get(targetUser, packDate);
  console.log(' ✅ 前台唤醒包查询命中率:', !!wakeupCheck);

  const listenCheck = dailyListenPreGenerateService.getPregeneratedCombo(db, {
    userId: targetUser, theme, genre: 'meeting', cefrLevel: 'B1', duration: 1, date: packDate
  });
  console.log(' ✅ 前台 1m 精听查询状态:', listenCheck.status, '音频链接:', listenCheck.audio?.audioUrl);

  console.log('\n================ 全量可调调试数据准备完毕！ ====================\n');
  process.exit(0);
}

main().catch(e => {
  console.error('铺设失败:', e);
  process.exit(1);
});
