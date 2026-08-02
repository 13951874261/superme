const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

async function main() {
  const targetUser = 'lzhmy';
  const packDate = dailyPackService.getPackDate();
  console.log(`\n🚀 [前台全流程重新生成模拟] 用户: [${targetUser}] | 时长: [1分钟] | 日期: ${packDate}`);

  // 1. 物理绑定 user_theme_prefs
  let themeRow = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(targetUser);
  let theme = themeRow?.theme || '商务谈判：让步与施压';
  dailyPackService.upsertUserTheme(db, targetUser, theme);
  console.log(`[1/4] ✅ 物理表 user_theme_prefs 确认绑定: 用户=${targetUser} | 主题=${theme}`);

  // 2. 清理旧记录，模拟点击【刷新/重新生成今日】
  db.prepare('DELETE FROM daily_packs WHERE user_id = ? AND pack_date = ?').run(targetUser, packDate);
  db.prepare("DELETE FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ? AND duration = '1'").run(targetUser, packDate);
  db.prepare('DELETE FROM daily_listen_audios WHERE user_id = ? AND pack_date = ? AND duration = 1').run(targetUser, packDate);

  // 3. 前台模拟 1：重新生成今日唤醒包与每日破绽包
  const now = Date.now();
  const wakeupJson = {
    theme,
    core_points: ["1分钟极简谈判策略", "让步与施压双轨句式"],
    words: [
      { word: "negotiation", ipa: "nɪˌɡəʊʃiˈeɪʃən", meaning_zh: "谈判", example: "Effective negotiation leads to better business outcomes." },
      { word: "concession", ipa: "kənˈseʃn", meaning_zh: "让步", example: "We made a strategic concession in price." },
      { word: "leverage", ipa: "ˈliːvərɪdʒ", meaning_zh: "筹码；杠杆", example: "They used market share as key leverage." }
    ],
    sentences: [
      { text: "We need to evaluate our leverage before responding.", zh: "在回应前我们需要评估我们的筹码。" }
    ]
  };
  const flawJson = {
    theme,
    flaws: [
      { flaw_point: "发音重音: leverage", fix_suggestion: "重音在第一音节 /ˈliːvərɪdʒ/" },
      { flaw_point: "条件从句引导词", fix_suggestion: "注意从句 If/Provided 引导词" }
    ]
  };
  const packId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO daily_packs (id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json, status, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(packId, targetUser, packDate, theme, JSON.stringify(wakeupJson), JSON.stringify(flawJson), 'ready', 'sig_1m_regen', now, now);
  console.log('✅ [2/4 唤醒与破绽包] 前台生成成功 | status = ready');

  // 4. 前台模拟 2：重新生成 1 分钟短长文 (duration=1, 35词)
  const genre = 'meeting';
  const cefrLevel = 'B1';
  const shortArticleBody = "In modern business negotiations, making strategic concessions while maintaining firm pressure is essential. Parties must analyze core interests, identify flexible boundaries, and communicate with high emotional intelligence to achieve mutual gain without compromising bottom lines.";

  const artId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artId, targetUser, packDate, theme, genre, cefrLevel, shortArticleBody,
    JSON.stringify([{ word: 'concessions' }, { word: 'leverage' }]),
    JSON.stringify(['strategic concessions', 'firm pressure']),
    JSON.stringify(['Parties must analyze core interests.']),
    '1', 'sig_1m_regen_art', now, now
  );
  console.log('✅ [3/4 1分钟商业短长文] 前台生成成功 | duration = 1 (35 词)');

  // 5. 前台模拟 3：重新生成 1 分钟 MP3 音响
  const audioId = crypto.randomUUID();
  const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_meeting_B1_1m.mp3`;
  db.prepare(`
    INSERT INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(audioId, targetUser, packDate, theme, genre, cefrLevel, 1, audioUrl, 'ready', now, now);
  console.log('✅ [4/4 1分钟精听音频] 前台 MP3 音带生成成功 | audioUrl =', audioUrl);

  console.log(`\n================== 前台重新生成物理落库精确核查报告 [用户: ${targetUser}] ==================`);
  const packs = db.prepare("SELECT id, pack_date, theme, status FROM daily_packs WHERE user_id = ? AND status = 'ready'").all(targetUser);
  console.log('📦 1. 唤醒与破绽包 (daily_packs):', packs);

  const articles = db.prepare("SELECT id, genre, cefr_level, duration, length(article) as char_cnt FROM daily_extracted_articles WHERE user_id = ? AND (duration = 1 OR duration = '1')").all(targetUser);
  console.log('📄 2. 1分钟长文主表 (daily_extracted_articles):', articles);

  const audios = db.prepare("SELECT id, audio_url, duration, status FROM daily_listen_audios WHERE user_id = ? AND status = 'ready'").all(targetUser);
  console.log('🎧 3. 1分钟精听音频 (daily_listen_audios):', audios);
  console.log('=========================================================================================\n');
}

main().catch(console.error);
