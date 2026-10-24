const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

async function generateForUser(targetUser) {
  console.log(`\n================ [02:00 AM Cron 专属生成] 用户: [${targetUser}] (1分钟资源) ================`);
  const packDate = dailyPackService.getPackDate();
  const theme = "商务谈判：让步与施压";
  const now = Date.now();

  // 0. 自动绑定 user_theme_prefs 物理表
  dailyPackService.upsertUserTheme(db, targetUser, theme);
  console.log(`[0/3] ✅ 主题绑定: 用户=${targetUser} | 主题=${theme}`);

  // 1. 物理写入 daily_packs 唤醒包与破绽词汇包
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
  const packId = crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO daily_packs (id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json, status, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(packId, targetUser, packDate, theme, JSON.stringify(wakeupJson), JSON.stringify(flawJson), 'ready', `sig_1m_cron_${targetUser}`, now, now);
  console.log(`[1/3] ✅ daily_packs 唤醒包与破绽词汇包写入成功 (用户: ${targetUser})`);

  // 2. 物理写入 1 分钟短长文
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
    '1', `sig_1m_prod_${targetUser}`, now, now
  );

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
  console.log(`[2/3] ✅ 1 分钟长文落库成功 (用户: ${targetUser})`);

  // 3. 绑定 mp3 音档
  const audioId = crypto.randomUUID();
  const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_meeting_B1_1m.mp3`;
  db.prepare(`
    INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(audioId, targetUser, packDate, theme, genre, cefrLevel, 1, audioUrl, 'ready', now, now);
  console.log(`[3/3] ✅ 精听音档 mp3 绑定成功: ${audioUrl}`);
}

async function main() {
  await generateForUser('lzhmy');
  await generateForUser('lzhumy');

  console.log('\n================== 物理数据库多账号落库核查报告 ==================');
  const packs = db.prepare("SELECT user_id, pack_date, theme, status FROM daily_packs WHERE user_id IN ('lzhmy', 'lzhumy') AND status = 'ready'").all();
  console.table(packs);

  const articles = db.prepare("SELECT user_id, genre, cefr_level, duration, length(article) as char_cnt FROM daily_extracted_articles WHERE user_id IN ('lzhmy', 'lzhumy')").all();
  console.table(articles);

  const audios = db.prepare("SELECT user_id, audio_url, duration, status FROM daily_listen_audios WHERE user_id IN ('lzhmy', 'lzhumy') AND status = 'ready'").all();
  console.table(audios);
  console.log('==================================================================\n');
}

main().catch(console.error);
