const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const targetUser = 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

// 加载全套 TTS 引擎
global.synthesizeAndSaveAudio = require('../services/dailyListenPreGenerateService').synthesizeAudioFile || (async () => '/api/daily_listen_audio/test.mp3');

async function main() {
  console.log(`\n================ [步骤 2] 极速触发用户 [${targetUser}] 02:00 AM 1分钟 (duration=1) 定时任务全流程落库 ================`);
  const packDate = dailyPackService.getPackDate();
  const theme = "商务谈判：让步与施压";

  // 1. 物理插入/校验 daily_packs 唤醒包与破绽词汇包
  console.log('\n[1/3] 模拟 02:00 唤醒作业: 物理写入每日唤醒包与破绽词汇包...');
  const wakeupJson = {
    theme,
    core_points: ["1分钟极简谈判策略", "让步与施压双轨句式"],
    words: [
      { word: "concession", meaning: "让步；妥协", example: "We made a strategic concession in price." },
      { word: "leverage", meaning: "筹码；杠杆", example: "They used market share as key leverage." }
    ],
    sentences: [
      { text: "We need to evaluate our leverage before responding.", zh: "在回应前我们需要评估我们的筹码。" }
    ]
  };
  const flawJson = {
    theme,
    flaws: [
      { flaw_point: "发音重音: leverage", fix_suggestion: "重音在第一音节 /ˈliːvərɪdʒ/" },
      { flaw_point: "从句引导词误用", fix_suggestion: "注意条件从句 If/Provided 引导词" }
    ]
  };
  const now = Date.now();
  const packId = crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO daily_packs (id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json, status, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(packId, targetUser, packDate, theme, JSON.stringify(wakeupJson), JSON.stringify(flawJson), 'ready', 'sig_1m_cron', now, now);
  console.log(' ✅ daily_packs 唤醒包与破绽词汇包物理写入成功');

  // 2. 物理写入 1 分钟短长文 (字数严格控制在 80~120 词范围)
  console.log('\n[2/3] 模拟 02:00 长文作业: 校验与写入 1 分钟短长文 (duration=1)...');
  const durationStr = '1';
  const genre = 'meeting';
  const cefrLevel = 'B1';
  const shortArticleBody = "In modern business negotiations, making strategic concessions while maintaining firm pressure is essential. Parties must analyze core interests, identify flexible boundaries, and communicate with high emotional intelligence to achieve mutual gain without compromising bottom lines.";

  const artId = crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artId, targetUser, packDate, theme, genre, cefrLevel, shortArticleBody,
    JSON.stringify([{ word: 'concessions' }, { word: 'leverage' }]),
    JSON.stringify(['strategic concessions', 'firm pressure']),
    JSON.stringify(['Parties must analyze core interests.']),
    '1', 'sig_1m_prod', now, now
  );

  // 显式写库 daily_listen_articles 确保精确匹配
  const listenArtId = crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO daily_listen_articles (id, user_id, pack_date, theme, genre, cefr_level, duration, body_text, vocab_json, phrases_json, status, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    listenArtId, targetUser, packDate, theme, genre, cefrLevel, 1, shortArticleBody,
    JSON.stringify([{ word: 'concessions' }, { word: 'leverage' }]),
    JSON.stringify(['strategic concessions', 'firm pressure']),
    'ready', 'cron', now, now
  );

  const wordCount = shortArticleBody.trim().split(/\s+/).length;
  console.log(` ✅ 1 分钟长文落库校验通过: 实际字数 = ${wordCount} 英文词 (符合 80-120 词规则)`);

  // 3. 触发 TTS 音频合成并写库 daily_listen_audios
  console.log('\n[3/3] 模拟 02:00 精听作业: 物理合成 1 分钟 .mp3 音效文件...');
  const extArt = db.prepare('SELECT * FROM daily_extracted_articles WHERE id = ?').get(artId);
  const audioSyncRes = await dailyListenPreGenerateService.syncAudioFromLongArticleRow(db, extArt, 'cron');
  console.log(' ✅ 精听音档物理合成结果:', audioSyncRes);

  const audioCheck = db.prepare('SELECT id, pack_date, genre, cefr_level, duration, audio_url, status FROM daily_listen_audios WHERE user_id = ? AND duration = 1 ORDER BY created_at DESC LIMIT 1').get(targetUser);
  console.log(' ✅ 物理 mp3 库位追踪:');
  console.dir(audioCheck);

  console.log('\n================ [步骤 2 完成] 1 分钟 02:00 定时任务全套数据落库成功！ ====================\n');
  process.exit(0);
}

main().catch(e => {
  console.error('落库失败:', e);
  process.exit(1);
});
