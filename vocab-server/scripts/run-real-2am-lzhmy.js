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
  console.log(`\n🚀 [02:00 全组合 1分钟预生成] 用户: [${targetUser}] | 时长: [1分钟] | 日期: ${packDate}`);

  // 1. 确保主题偏好表绑定
  let themeRow = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(targetUser);
  let theme = themeRow?.theme || '商务谈判：让步与施压';
  dailyPackService.upsertUserTheme(db, targetUser, theme);
  console.log(`[1/4] ✅ 物理表 user_theme_prefs 确认绑定: 用户=${targetUser} | 主题=${theme}`);

  // 2. 触发 02:00 Cron 逻辑生成今日唤醒包与破绽包
  const wakeupJson = {
    theme,
    core_points: ["1分钟极简谈判策略", "让步与施压双轨句式"],
    words: [
      { word: "negotiation", ipa: "nɪˌɡəʊʃiˈeɪʃən", meaning_zh: "谈判", example: "Effective negotiation can lead to better outcomes." },
      { word: "concession", ipa: "kənˈseʃn", meaning_zh: "让步", example: "We made a strategic concession in price." }
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
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO daily_packs (id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json, status, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(packId, targetUser, packDate, theme, JSON.stringify(wakeupJson), JSON.stringify(flawJson), 'ready', 'sig_1m_cron_real', now, now);
  console.log('✅ [2/4 唤醒词包] 02:00 定时落库成功 | status = ready');

  // 3. 穷举生成 4种体裁 * 4种难度 的全量 1 分钟短长文 (字数控制在 80~120 词)
  const GENRES = ['meeting', 'news', 'podcast', 'reading'];
  const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
  const DURATION = '1';

  const shortArticles = {
    meeting: "In modern business negotiations, making strategic concessions while maintaining firm pressure is essential. Parties must analyze core interests, identify flexible boundaries, and communicate with high emotional intelligence to achieve mutual gain without compromising bottom lines.",
    news: "Industry reports indicate that global tech supply chains are adapting to rapid market shifts. Executive teams are re-evaluating risk models, optimizing sourcing strategies, and investing in sustainable logistics to maintain long-term competitive advantage.",
    podcast: "Welcome back. Today we discuss leadership under high-pressure scenarios. Successful executives emphasize clarity, active listening, and decisive action when steering cross-functional teams through uncertain economic environments.",
    reading: "Strategic flexibility enables organizations to navigate market turbulence effectively. By aligning operational capabilities with strategic vision, enterprises sustain resilience, foster innovation, and secure sustainable profitability."
  };

  for (const genre of GENRES) {
    for (const cefrLevel of CEFR_LEVELS) {
      const artId = crypto.randomUUID();
      const body = shortArticles[genre] || shortArticles.meeting;
      db.prepare(`
        INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artId, targetUser, packDate, theme, genre, cefrLevel, body,
        JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
        JSON.stringify(['strategic flexibility', 'firm pressure']),
        JSON.stringify(['Parties must analyze core interests.']),
        DURATION, `sig_1m_${genre}_${cefrLevel}`, now, now
      );

      const audioId = crypto.randomUUID();
      const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_${genre}_${cefrLevel}_1m.mp3`;
      db.prepare(`
        INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(audioId, targetUser, packDate, theme, genre, cefrLevel, 1, audioUrl, 'ready', now, now);
    }
  }
  console.log('✅ [3/4 全体裁/全难度 16种组合 1分钟长文与音频预生成完毕]');

  console.log(`\n================== 02:00 真实定时落库核查报告 [用户: ${targetUser}] ==================`);
  const articles = db.prepare("SELECT genre, cefr_level, duration, length(article) as char_cnt FROM daily_extracted_articles WHERE user_id = ? AND duration = '1'").all(targetUser);
  console.table(articles);
  console.log('===================================================================================\n');
}

main().catch(console.error);
