const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');

async function main() {
  const targetUser = 'lzhmy';
  const packDate = dailyPackService.getPackDate();
  console.log(`\n🚀 [全量 28种 1分钟 100% 精准体裁短长文生成] 用户: [${targetUser}] | 时长: [1分钟] | 日期: ${packDate}`);

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
  `).run(packId, targetUser, packDate, theme, JSON.stringify(wakeupJson), JSON.stringify(flawJson), 'ready', 'sig_1m_28combos', now, now);

  // 3. 7 种完全独立的精准体裁 矩阵
  const articlesMatrix = {
    meeting: {
      A2: "In simple team meetings, we talk about prices and work plans carefully. Everyone must listen to their managers and find good ways to work together easily.",
      B1: "During board meetings, directors evaluate project budgets and set upcoming operational targets. Teams coordinate closely to ensure execution timelines stay on schedule.",
      B2: "In executive committee meetings, senior leaders align corporate strategy with Q3 performance metrics, identifying operational bottlenecks and allocating key capital resources.",
      C1: "Convening the executive board, leaders scrupulously assess strategic risks and capital allocations, juxtaposing short-term earnings targets against long-term competitive positioning."
    },
    email: {
      A2: "Dear Team, please send me the sales report by 5 PM today. Thank you for your hard work and help with this project.",
      B1: "Dear Partner, regarding our contract discussion, we propose updating section 3 to reflect current delivery schedules and agreed pricing terms.",
      B2: "Dear Stakeholders, this email summarizes our strategic posture following recent regulatory changes, outlining immediate operational adjustments and compliance steps.",
      C1: "Dear Board Members, hereunder is our comprehensive memorandum detailing the preemptive acquisition framework and cross-border tax optimization structures."
    },
    report: {
      A2: "This market report shows that online shopping is growing fast in Asia. Customers like buying electronics and clothes using mobile phones.",
      B1: "Recent industry reports indicate that renewable energy investments are driving tech sector expansion, creating new commercial opportunities for agile market entrants.",
      B2: "Quarterly industry research highlights key growth vectors across emerging cloud computing markets, emphasizing subscription revenue stability and enterprise adoption rates.",
      C1: "Empirical macroeconomic research underscores persistent structural shifts within global semiconductor supply chains, forecasting capital expenditure trends through 2030."
    },
    negotiation: {
      A2: "We want a lower price for these goods, but the seller wants a longer contract. We need to compromise carefully today.",
      B1: "During commercial negotiations, we offered flexible payment terms in exchange for volume discounts, reaching a balanced agreement for both parties.",
      B2: "In high-stakes commercial negotiations, making strategic concessions while maintaining firm pressure is essential to achieve mutual gain without compromising core boundaries.",
      C1: "Navigating high-stakes commercial bargaining necessitates calculated concessions juxtaposed with unrelenting strategic leverage, evaluating underlying motives to articulate nuanced counterproposals."
    },
    presentation: {
      A2: "Welcome everyone. Today I will show you our new product features and explain how they help customers save time every day.",
      B1: "Good morning investors. Today's presentation focuses on our market expansion plan for 2026, highlighting user acquisition growth and financial milestones.",
      B2: "Welcome stakeholders. Our roadshow presentation demonstrates key financial projections, unit economics, and scalable business models for international markets.",
      C1: "Esteemed venture partners, this investor presentation delineates our disruptive technology roadmap, projected EBITDA margins, and strategic expansion into enterprise markets."
    },
    reading: {
      A2: "Good business planning helps companies save money and time. When employees work together nicely, projects finish quickly and customers stay happy.",
      B1: "Strategic planning helps growing companies navigate daily market challenges effectively. Aligning team efforts with corporate goals ensures steady growth.",
      B2: "Strategic flexibility enables modern organizations to navigate market turbulence. By aligning operational capabilities with strategic vision, enterprises sustain resilience.",
      C1: "Organizational longevity relies upon dynamic capabilities that assimilate nascent technologies. Disruption management requires preemptive resource reallocation."
    },
    news: {
      A2: "Big retail stores are opening new locations across the country today. Customers are buying products quickly because discount prices are lower now.",
      B1: "Financial news reports indicate that central bank interest rate decisions are influencing stock indices, prompting corporate CFOs to adjust capital allocation plans.",
      B2: "Bloomberg news reports highlight that global tech supply chains are adapting to rapid market shifts, with executive teams re-evaluating risk models.",
      C1: "Macroeconomic headlines report that currency volatility has impelled enterprise leaders to recalibrate operational frameworks and institute resilient supply networks."
    }
  };

  const GENRES = ['meeting', 'email', 'report', 'negotiation', 'presentation', 'reading', 'news'];
  const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];

  for (const genre of GENRES) {
    for (const cefrLevel of CEFR_LEVELS) {
      const artId = crypto.randomUUID();
      const body = articlesMatrix[genre][cefrLevel];
      db.prepare(`
        INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artId, targetUser, packDate, theme, genre, cefrLevel, body,
        JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
        JSON.stringify(['strategic flexibility', 'firm pressure']),
        JSON.stringify([body.split('.')[0] + '.']),
        '1', `sig_1m_${genre}_${cefrLevel}`, now, now
      );

      const audioId = crypto.randomUUID();
      const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_${genre}_${cefrLevel}_1m.mp3`;
      db.prepare(`
        INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(audioId, targetUser, packDate, theme, genre, cefrLevel, 1, audioUrl, 'ready', now, now);
    }
  }

  console.log('[3/3] ✅ 用户 lzhmy 的 7种体裁 * 4种难度 = 28种 100% 精准英文短长文预生成全量完成!');

  console.log(`\n================== 28种精准组合物理落库核查报告 [用户: ${targetUser}] ==================`);
  const articles = db.prepare("SELECT genre, cefr_level, duration, length(article) as char_cnt, article FROM daily_extracted_articles WHERE user_id = 'lzhmy' AND (duration = 1 OR duration = '1') ORDER BY genre, cefr_level").all();
  console.table(articles);
  console.log(`总计生成组合数: ${articles.length} 条 (预期 28 条)`);
  console.log('===================================================================================\n');
}

main().catch(console.error);
