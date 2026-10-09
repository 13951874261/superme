const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');

async function main() {
  const targetUsers = ['lzhmy', 'lzhumy'];
  const packDate = dailyPackService.getPackDate();
  console.log(`\n🚀 [全量 112组合 (4时长 * 7体裁 * 4难度) 物理落库] 目标用户: [${targetUsers.join(', ')}] | 日期: ${packDate}`);

  // 1. 物理清空测试账号的已有数据
  db.prepare("DELETE FROM daily_packs WHERE user_id IN ('lzhmy', 'lzhumy')").run();
  db.prepare("DELETE FROM daily_extracted_articles WHERE user_id IN ('lzhmy', 'lzhumy')").run();
  db.prepare("DELETE FROM daily_listen_articles WHERE user_id IN ('lzhmy', 'lzhumy')").run();
  db.prepare("DELETE FROM daily_listen_audios WHERE user_id IN ('lzhmy', 'lzhumy')").run();

  // 2. 绑定主题
  for (const uid of targetUsers) {
    dailyPackService.upsertUserTheme(db, uid, '商务谈判：让步与施压');
  }

  // 3. 落库唤醒包与破绽包
  const now = Date.now();
  for (const uid of targetUsers) {
    const wakeupJson = {
      theme: '商务谈判：让步与施压',
      core_points: ["谈判策略", "让步与施压双轨句式"],
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
      theme: '商务谈判：让步与施压',
      flaws: [
        { flaw_point: "发音重音: leverage", fix_suggestion: "重音在第一音节 /ˈliːvərɪdʒ/" },
        { flaw_point: "条件从句引导词", fix_suggestion: "注意从句 If/Provided 引导词" }
      ]
    };
    db.prepare(`
      INSERT OR REPLACE INTO daily_packs (id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json, status, input_signature, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), uid, packDate, '商务谈判：让步与施压', JSON.stringify(wakeupJson), JSON.stringify(flawJson), 'ready', 'sig_matrix_full', now, now);
  }

  // 4. 112 种组合 (4时长 * 7体裁 * 4难度) 文章矩阵
  const baseArticles = {
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

  const DURATIONS = ['1', '15', '25', '35'];
  const GENRES = ['meeting', 'email', 'report', 'negotiation', 'presentation', 'reading', 'news'];
  const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];

  let count = 0;
  for (const uid of targetUsers) {
    for (const duration of DURATIONS) {
      const durInt = parseInt(duration, 10);
      for (const genre of GENRES) {
        for (const cefrLevel of CEFR_LEVELS) {
          const artId = crypto.randomUUID();
          let body = baseArticles[genre][cefrLevel];
          
          // 严格区分不同时长的正文篇幅！
          if (duration === '1') {
            // 1分钟：保持纯粹标准的精简 1 分钟英文正文
            body = baseArticles[genre][cefrLevel];
          } else if (duration === '15') {
            body = `${body} Furthermore, detailed operational guidelines require continuous alignment across department heads to optimize resource utilization and risk control.`;
          } else if (duration === '25') {
            body = `${body} Furthermore, detailed operational guidelines require continuous alignment across department heads to optimize resource utilization and risk control. In-depth quantitative metrics further validate market expansion projections across North American and European markets over the next five fiscal quarters.`;
          } else if (duration === '35') {
            body = `${body} Furthermore, detailed operational guidelines require continuous alignment across department heads to optimize resource utilization and risk control. In-depth quantitative metrics further validate market expansion projections across North American and European markets over the next five fiscal quarters. Consequently, executive leadership maintains a bullish outlook on long-term enterprise valuation and sustainable competitive advantage.`;
          }

          // 同时写 daily_extracted_articles 主长文表
          db.prepare(`
            INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            artId, uid, packDate, '商务谈判：让步与施压', genre, cefrLevel, body,
            JSON.stringify(['strategy', 'leverage', 'concession']),
            JSON.stringify(['strategic flexibility', 'firm pressure', 'operational targets']),
            JSON.stringify([body.split('.')[0] + '.']),
            duration, `sig_${duration}m_${genre}_${cefrLevel}`, now, now
          );

          // 同时写 daily_listen_articles 听力长文表
          const listenArtId = crypto.randomUUID();
          db.prepare(`
            INSERT OR REPLACE INTO daily_listen_articles (id, user_id, pack_date, theme, genre, cefr_level, duration, body_text, vocab_json, phrases_json, status, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            listenArtId, uid, packDate, '商务谈判：让步与施压', genre, cefrLevel, durInt, body,
            JSON.stringify(['strategy', 'leverage', 'concession']),
            JSON.stringify(['strategic flexibility', 'firm pressure', 'operational targets']),
            'ready', 'cron', now, now
          );

          const audioId = crypto.randomUUID();
          const audioUrl = `/api/daily_listen_audio/${uid}/${packDate}_${genre}_${cefrLevel}_${duration}m.mp3`;
          db.prepare(`
            INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(audioId, uid, packDate, '商务谈判：让步与施压', genre, cefrLevel, durInt, audioUrl, 'ready', now, now);
          count++;
        }
      }
    }
  }

  console.log(`\n================📊 全量矩阵落库报告 [用户: ${targetUsers.join(', ')}] ================`);
  console.log(`✅ 成功落库用户账号数: ${targetUsers.length}`);
  console.log(`✅ 成功落库短长文主表与音频文件记录总数: ${count} 条 (预期 4时长 * 7体裁 * 4难度 * 2用户 = 224 条数据记录)`);
  console.log('====================================================================================\n');
}

main().catch(console.error);
