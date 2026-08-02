const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');

async function main() {
  const targetUser = 'lzhmy';
  const packDate = dailyPackService.getPackDate();
  console.log(`\n🚀 [02:00 CEFR 难度差异化预生成] 用户: [${targetUser}] | 时长: [1分钟] | 日期: ${packDate}`);

  // 1. 确保主题偏好表绑定
  let themeRow = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(targetUser);
  let theme = themeRow?.theme || '商务谈判：让步与施压';
  dailyPackService.upsertUserTheme(db, targetUser, theme);

  // 2. 区分 4 种难度 (A2 / B1 / B2 / C1) 差异化短长文
  const articlesByCefr = {
    meeting: {
      A2: "In business meetings, talking carefully is important. Both teams need to listen and find simple solutions so everyone is happy with the result.",
      B1: "During modern business negotiations, making small concessions while keeping key requests is essential. Teams should discuss clear goals and compromise when necessary.",
      B2: "In modern business negotiations, making strategic concessions while maintaining firm pressure is essential. Parties must analyze core interests, identify flexible boundaries, and communicate with high emotional intelligence.",
      C1: "Navigating high-stakes commercial negotiations necessitates calculated concessions juxtaposed with unrelenting strategic leverage. Negotiators must scrupulously evaluate underlying motives and articulate nuanced counterproposals."
    },
    news: {
      A2: "Company sales are growing this month. Managers are hiring new workers and opening small stores in big cities to serve more customers.",
      B1: "Recent market reports show that tech supply chains are adapting to new trends. Companies are improving production plans and looking for reliable suppliers.",
      B2: "Industry analysis indicates that global tech supply chains are adapting to rapid market shifts. Executive teams are re-evaluating risk models and optimizing sourcing strategies.",
      C1: "Global macroeconomic volatility has impelled enterprise leaders to recalibrate operational frameworks, hedge foreign exchange exposure, and institute resilient supply networks."
    },
    podcast: {
      A2: "Welcome to our show. Today we talk about good teamwork. Small team habits can make daily work much easier and faster for everyone.",
      B1: "Welcome back. Today we discuss effective team communication. Good leaders focus on active listening and giving clear feedback to team members.",
      B2: "Welcome back. Today we discuss leadership under high-pressure scenarios. Successful executives emphasize clarity, active listening, and decisive action in complex environments.",
      C1: "Welcome to executive insights. Today we dissect adaptive leadership paradigms. Prominent CEOs cultivate organizational agility, foster psychological safety, and orchestrate transformative shifts."
    },
    reading: {
      A2: "Good planning helps companies save money. When employees work together nicely, projects finish on time and customers stay happy.",
      B1: "Strategic planning helps businesses navigate daily challenges. Aligning team efforts with company goals ensures steady growth and customer satisfaction.",
      B2: "Strategic flexibility enables organizations to navigate market turbulence. By aligning operational capabilities with strategic vision, enterprises sustain resilience and foster innovation.",
      C1: "Organizational longevity relies upon dynamic capabilities that assimilate nascent technologies. Disruption management requires preemptive resource reallocation and proactive stakeholder alignment."
    }
  };

  const GENRES = ['meeting', 'news', 'podcast', 'reading'];
  const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
  const DURATION = '1';
  const now = Date.now();

  for (const genre of GENRES) {
    for (const cefrLevel of CEFR_LEVELS) {
      const artId = crypto.randomUUID();
      const body = articlesByCefr[genre][cefrLevel];
      db.prepare(`
        INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artId, targetUser, packDate, theme, genre, cefrLevel, body,
        JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
        JSON.stringify(['strategic flexibility', 'firm pressure']),
        JSON.stringify([body.split('.')[0] + '.']),
        DURATION, `sig_1m_${genre}_${cefrLevel}_diff`, now, now
      );

      const audioId = crypto.randomUUID();
      const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_${genre}_${cefrLevel}_1m.mp3`;
      db.prepare(`
        INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(audioId, targetUser, packDate, theme, genre, cefrLevel, 1, audioUrl, 'ready', now, now);
    }
  }

  console.log('\n================== CEFR 难度差异化落库核查报告 [用户: lzhmy] ==================');
  const articles = db.prepare("SELECT genre, cefr_level, duration, length(article) as char_cnt, article FROM daily_extracted_articles WHERE user_id = 'lzhmy' AND duration = '1'").all();
  console.table(articles);
  console.log('===================================================================================\n');
}

main().catch(console.error);
