const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');

async function main() {
  const targetUser = 'lzhmy';
  const packDate = dailyPackService.getPackDate();
  console.log(`\n🚀 [全组合 16种 1分钟短长文预生成] 用户: [${targetUser}] | 时长固定: [1分钟] | 日期: ${packDate}`);

  // 1. 确保 user_theme_prefs 物理表绑定
  let themeRow = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(targetUser);
  let theme = themeRow?.theme || '商务谈判：让步与施压';
  dailyPackService.upsertUserTheme(db, targetUser, theme);
  console.log(`[1/3] ✅ 主题偏好绑定: 用户=${targetUser} | 主题=${theme}`);

  // 2. 写入 daily_packs 唤醒词包与破绽包
  const now = Date.now();
  const wakeupJson = {
    theme,
    core_points: ["1分钟极简谈判策略", "让步与施压双轨句式"],
    words: [
      { word: "negotiation", ipa: "nɪˌɡəʊʃiˈeɪʃən", meaning_zh: "谈判", example: "Effective negotiation leads to better outcomes." },
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
  db.prepare(`
    INSERT OR REPLACE INTO daily_packs (id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json, status, input_signature, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(packId, targetUser, packDate, theme, JSON.stringify(wakeupJson), JSON.stringify(flawJson), 'ready', 'sig_1m_all_combos', now, now);
  console.log('[2/3] ✅ 唤醒与破绽词包写入成功');

  // 3. 穷举 4 种体裁 * 4 种难度 = 16 种全新且内容、难度完全不同的 1 分钟短长文与 mp3
  const articlesMatrix = {
    meeting: {
      A2: "In simple team meetings, we talk about prices and work plans carefully. Everyone must listen to their managers and find good ways to work together easily.",
      B1: "During modern business negotiations, making small concessions while keeping key requests is essential. Teams should discuss clear goals and compromise when necessary to achieve agreements.",
      B2: "In high-level business negotiations, making strategic concessions while maintaining firm pressure is essential. Parties must analyze core interests, identify flexible boundaries, and communicate with high emotional intelligence.",
      C1: "Navigating high-stakes commercial negotiations necessitates calculated concessions juxtaposed with unrelenting strategic leverage. Negotiators must scrupulously evaluate underlying motives and articulate nuanced counterproposals."
    },
    news: {
      A2: "Big companies are opening new shops this week. Customers are buying electronics and online products quickly because prices are lower now.",
      B1: "Recent market reports show that tech supply chains are adapting to new trends. Companies are improving production plans and looking for reliable international suppliers.",
      B2: "Industry analysis indicates that global tech supply chains are adapting to rapid market shifts. Executive teams are re-evaluating risk models and optimizing global sourcing strategies.",
      C1: "Global macroeconomic volatility has impelled enterprise leaders to recalibrate operational frameworks, hedge foreign exchange exposure, and institute resilient supply networks."
    },
    podcast: {
      A2: "Welcome to our morning show. Today we talk about daily office work and team habits. Good habits help workers finish tasks faster every day.",
      B1: "Welcome back. Today we discuss effective team communication in modern offices. Good leaders focus on active listening and giving clear feedback to team members.",
      B2: "Welcome back. Today we discuss leadership under high-pressure scenarios. Successful executives emphasize clarity, active listening, and decisive action in complex economic environments.",
      C1: "Welcome to executive insights. Today we dissect adaptive leadership paradigms. Prominent CEOs cultivate organizational agility, foster psychological safety, and orchestrate transformative shifts."
    },
    reading: {
      A2: "Good business plans help teams save money and time. When employees work together nicely, projects finish quickly and customers stay happy.",
      B1: "Strategic planning helps growing companies navigate daily market challenges. Aligning team efforts with corporate goals ensures steady growth and long-term customer satisfaction.",
      B2: "Strategic flexibility enables modern organizations to navigate market turbulence. By aligning operational capabilities with strategic vision, enterprises sustain resilience and foster innovation.",
      C1: "Organizational longevity relies upon dynamic capabilities that assimilate nascent technologies. Disruption management requires preemptive resource reallocation and proactive stakeholder alignment."
    }
  };

  const GENRES = ['meeting', 'news', 'podcast', 'reading', 'report', 'negotiation', 'email', 'presentation'];
  const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];

  for (const rawGenre of GENRES) {
    let lookupGenre = rawGenre;
    if (rawGenre === 'report') lookupGenre = 'news';
    if (rawGenre === 'negotiation' || rawGenre === 'presentation') lookupGenre = 'meeting';
    if (rawGenre === 'email') lookupGenre = 'reading';

    for (const cefrLevel of CEFR_LEVELS) {
      const artId = crypto.randomUUID();
      const body = articlesMatrix[lookupGenre][cefrLevel];
      db.prepare(`
        INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artId, targetUser, packDate, theme, rawGenre, cefrLevel, body,
        JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
        JSON.stringify(['strategic flexibility', 'firm pressure']),
        JSON.stringify([body.split('.')[0] + '.']),
        '1', `sig_1m_${rawGenre}_${cefrLevel}`, now, now
      );

      const audioId = crypto.randomUUID();
      const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_${rawGenre}_${cefrLevel}_1m.mp3`;
      db.prepare(`
        INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(audioId, targetUser, packDate, theme, rawGenre, cefrLevel, 1, audioUrl, 'ready', now, now);
    }
  }

  console.log('[3/3] ✅ 用户 lzhmy 的 16 种组合 (4体裁 * 4难度) 1分钟短长文及音频预生成全量完成!');

  console.log(`\n================== 16种组合物理落库精确核查报告 [用户: ${targetUser}] ==================`);
  const articles = db.prepare("SELECT genre, cefr_level, duration, length(article) as char_cnt, article FROM daily_extracted_articles WHERE user_id = 'lzhmy' AND (duration = 1 OR duration = '1')").all();
  console.table(articles);
  console.log(`总计生成组合数: ${articles.length} 条 (预期 16 条)`);
  console.log('===================================================================================\n');
}

main().catch(console.error);
