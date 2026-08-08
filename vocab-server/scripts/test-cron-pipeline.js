const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dailyPackService = require('../services/dailyPackService');
const dailyCronRunService = require('../services/dailyCronRunService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');
const dailyPackCron = require('../services/dailyPackCron');

// 1. 初始化数据库连接
const dbPath = process.env.NODE_ENV === 'production'
  ? '/var/www/super-agent/vocab.db'
  : path.join(__dirname, '..', 'vocab.db');

console.log('===========================================================');
console.log(' [Cron Pipeline Simulation] 开始模拟运行 2:00 后台定时任务');
console.log(` - 数据库路径: ${dbPath}`);
console.log('===========================================================\n');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 2. 初始化数据库表结构
dailyPackService.initDailyPackTables(db);
dailyCronRunService.initDailyCronRunTables(db);
dailyListenPreGenerateService.initDailyListenTables(db);
db.prepare(`
  CREATE TABLE IF NOT EXISTS daily_extracted_articles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    quota_date TEXT NOT NULL,
    theme TEXT NOT NULL,
    genre TEXT NOT NULL,
    cefr_level TEXT NOT NULL,
    article TEXT NOT NULL,
    words_json TEXT NOT NULL,
    phrases_json TEXT NOT NULL,
    sentences_json TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(user_id, quota_date, genre, cefr_level)
  )
`).run();

// 3. 解析命令行参数中的 userId (--userId=xxx) 和 theme (--theme=xxx)
const args = process.argv.slice(2);
let userId = 'default-user';
let theme = '商务谈判：让步与施压';

args.forEach((arg) => {
  if (arg.startsWith('--userId=')) userId = arg.split('=')[1];
  if (arg.startsWith('--theme=')) theme = arg.split('=')[1];
});

// 确保测试用户绑定了有效的主题设置
dailyPackService.upsertUserTheme(db, userId, theme);

async function runSimulation() {
  const packDate = dailyPackService.getPackDate();
  console.log(`[Step 0] 已为用户 [${userId}] 设置/同步主题: "${theme}" (日期: ${packDate})`);
  console.log('-----------------------------------------------------------\n');

  console.log('>>> 正在触发三步串行 Cron 编排任务 (runDailyPackCronJob)...');
  const startTime = Date.now();

  try {
    const summary = await dailyPackCron.runDailyPackCronJob(db, userId);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n===========================================================');
    console.log(` 🎉 模拟编排执行完成！总耗时: ${durationSec} 秒`);
    console.log('===========================================================');
    console.log(' 执行结果汇总:', summary);

    // 4. 从 SQLite 数据库中校验生成落地结果
    console.log('\n>>> 开始校验 SQLite 数据库持久化落地结果:');

    // 校验 1: daily_packs (唤醒 + 破绽)
    const packRow = db.prepare(
      'SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? ORDER BY created_at DESC LIMIT 1'
    ).get(userId, packDate);

    if (packRow) {
      const wakeup = dailyPackService.safeJsonParse ? dailyPackService.safeJsonParse(packRow.wakeup_json) : JSON.parse(packRow.wakeup_json || '{}');
      const flaw = dailyPackService.safeJsonParse ? dailyPackService.safeJsonParse(packRow.flaw_vocab_json) : JSON.parse(packRow.flaw_vocab_json || '[]');

      console.log('\n ✅ [验证 1: 每日唤醒 & 破绽词汇 (daily_packs)]');
      console.log(`   - 存储状态 (status): ${packRow.status}`);
      console.log(`   - 唤醒词数量: ${wakeup?.vocab ? wakeup.vocab.length : 0} 个`);
      console.log(`   - 语法讲义: ${wakeup?.grammar?.point || '无'}`);
      console.log(`   - 破绽词汇数量: ${Array.isArray(flaw) ? flaw.length : 0} 个`);
    } else {
      console.log('\n ⚠️ [验证 1: daily_packs] 未查到记录');
    }

    // 校验 2: daily_extracted_articles (长文正文与提纯)
    const articleRow = db.prepare(
      'SELECT * FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ? ORDER BY updated_at DESC LIMIT 1'
    ).get(userId, packDate);

    if (articleRow) {
      const words = JSON.parse(articleRow.words_json || '[]');
      const phrases = JSON.parse(articleRow.phrases_json || '[]');
      const sentences = JSON.parse(articleRow.sentences_json || '[]');

      console.log('\n ✅ [验证 2: 今日长文 & 提纯词汇 (daily_extracted_articles)]');
      console.log(`   - 主题: ${articleRow.theme} | 题材: ${articleRow.genre} | 难度: ${articleRow.cefr_level}`);
      console.log(`   - 长文字数: ${articleRow.article ? articleRow.article.length : 0} 字符`);
      console.log(`   - 提取生词: ${words.length} 个 -> [${words.slice(0, 5).join(', ')}${words.length > 5 ? '...' : ''}]`);
      console.log(`   - 提取短语: ${phrases.length} 个 -> [${phrases.slice(0, 3).join(', ')}${phrases.length > 3 ? '...' : ''}]`);
      console.log(`   - 提取句型: ${sentences.length} 个`);
      console.log(`   - 长文前 120 字片段:\n     "${(articleRow.article || '').substring(0, 120).replace(/\n/g, ' ')}..."`);
    } else {
      console.log('\n ⚠️ [验证 2: daily_extracted_articles] 未查到已保存的长文记录');
    }

    console.log('\n===========================================================');
    console.log(' 测试结束！如果两项验证均为 ✅，说明后台 3 步串行自动编排完全正常。');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n ❌ 模拟执行过程中发生错误:', err);
  } finally {
    db.close();
  }
}

runSimulation();
