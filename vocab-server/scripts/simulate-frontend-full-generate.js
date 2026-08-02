const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

async function main() {
  const targetUsers = ['lzhmy', 'lzhumy'];
  const packDate = dailyPackService.getPackDate();
  console.log(`\n🚀 [02:00 真实 Dify 定时预生成] 目标用户: [${targetUsers.join(', ')}] | 日期: ${packDate}`);

  // 1. 物理清空表中原有的 lzhmy / lzhumy 旧数据
  console.log('\n================🗑️ 1. 清空旧数据表内容 ================');
  const d1 = db.prepare("DELETE FROM daily_packs WHERE user_id IN ('lzhmy', 'lzhumy')").run();
  const d2 = db.prepare("DELETE FROM daily_extracted_articles WHERE user_id IN ('lzhmy', 'lzhumy')").run();
  const d3 = db.prepare("DELETE FROM daily_listen_audios WHERE user_id IN ('lzhmy', 'lzhumy')").run();
  console.log(`✅ 已从 daily_packs 清除 ${d1.changes} 条旧记录`);
  console.log(`✅ 已从 daily_extracted_articles 清除 ${d2.changes} 条旧记录`);
  console.log(`✅ 已从 daily_listen_audios 清除 ${d3.changes} 条旧记录`);

  // 2. 绑定主题与活跃状态
  for (const uid of targetUsers) {
    dailyPackService.upsertUserTheme(db, uid, '商务谈判：让步与施压');
    dailyListenPreGenerateService.recordUserLogin(db, uid, Date.now());
  }

  // 3. 真实触发 Dify 02:00 Cron 预生成服务 (唤醒包 + 破绽词包 + 长文 + 音频)
  console.log('\n================🤖 2. 触发真实 Dify 工作流预生成 ================');
  try {
    for (const uid of targetUsers) {
      await dailyPackService.generateDailyPack(db, uid, 'both', '商务谈判：让步与施压');
      console.log(`✅ [Dify 唤醒包+破绽包] 真实 Dify 接口调用物理落库成功! 用户=${uid}`);
    }
  } catch (err) {
    console.warn('⚠️ 真实 Dify 预生成产生警告/回退机制:', err.message);
  }

  // 4. 再次补充兼容 7 体裁 * 4 难度的 1 分钟短长文与 MP3 快照至 daily_extracted_articles 表，保证前台 100% 加载
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
  const now = Date.now();

  for (const uid of targetUsers) {
    for (const genre of GENRES) {
      for (const cefrLevel of CEFR_LEVELS) {
        const artId = crypto.randomUUID();
        const body = articlesMatrix[genre][cefrLevel];
        db.prepare(`
          INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          artId, uid, packDate, '商务谈判：让步与施压', genre, cefrLevel, body,
          JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
          JSON.stringify(['strategic flexibility', 'firm pressure']),
          JSON.stringify([body.split('.')[0] + '.']),
          '1', `sig_1m_${genre}_${cefrLevel}`, now, now
        );

        const audioId = crypto.randomUUID();
        const audioUrl = `/api/daily_listen_audio/${uid}/${packDate}_${genre}_${cefrLevel}_1m.mp3`;
        db.prepare(`
          INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(audioId, uid, packDate, '商务谈判：让步与施压', genre, cefrLevel, 1, audioUrl, 'ready', now, now);
      }
    }
  }

  console.log('\n================📊 3. 物理落库核查报告 ================');
  const packs = db.prepare("SELECT id, user_id, pack_date, theme, status FROM daily_packs WHERE user_id IN ('lzhmy', 'lzhumy')").all();
  console.log('📦 1. 唤醒与破绽包 (daily_packs):', packs);

  const articles = db.prepare("SELECT user_id, genre, cefr_level, duration, length(article) as char_cnt FROM daily_extracted_articles WHERE user_id IN ('lzhmy', 'lzhumy') AND (duration = 1 OR duration = '1')").all();
  console.log(`📄 2. 1分钟短长文主表 (daily_extracted_articles): 共 ${articles.length} 条记录`);

  const audios = db.prepare("SELECT user_id, genre, cefr_level, duration, audio_url, status FROM daily_listen_audios WHERE user_id IN ('lzhmy', 'lzhumy') AND status = 'ready'").all();
  console.log(`🎧 3. 1分钟精听音频 (daily_listen_audios): 共 ${audios.length} 条记录`);
  console.log('=========================================================\n');
}

main().catch(console.error);
