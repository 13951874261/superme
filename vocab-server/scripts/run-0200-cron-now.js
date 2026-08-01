const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dailyPackService = require('../services/dailyPackService');
const dailyPackCron = require('../services/dailyPackCron');

// 1. 初始化数据库连接
const dbPath = process.env.NODE_ENV === 'production' || __dirname.includes('/var/www')
  ? '/var/www/super-agent/vocab.db'
  : path.join(__dirname, '..', 'vocab.db');

console.log('===========================================================');
console.log(' 🚀 [02:00 Cron Immediate Trigger] 立即手动触发每日 02:00 后台作业');
console.log(` - 数据库路径: ${dbPath}`);
console.log('===========================================================\n');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 10000');

// 2. 初始化数据库结构
dailyPackService.initDailyPackTables(db);

// 3. 解析命令行参数 (--userId=xxx)
const args = process.argv.slice(2);
let targetUserId = null;

args.forEach((arg) => {
  if (arg.startsWith('--userId=')) {
    targetUserId = arg.split('=')[1];
  }
});

async function main() {
  const startTime = Date.now();
  const packDate = dailyPackService.getPackDate();

  if (targetUserId) {
    console.log(`🎯 指定运行目标用户: [${targetUserId}] (日期: ${packDate})`);
  } else {
    console.log(`🌐 批量运行模式: 正在扫描全库所有已同步主题的活跃用户 (日期: ${packDate})...`);
  }
  console.log('-----------------------------------------------------------\n');

  try {
    // 0. 数据库 1G 体积自动巡检与 LRU 物理页裁剪
    try {
      const contentCleanupService = require('../services/contentCleanupService');
      contentCleanupService.checkAndAutoCleanDatabase(db, dbPath);
    } catch (cleanupErr) {
      console.warn('⚠️ [Content Cleanup Warning]:', cleanupErr.message);
    }

    // 1. 运行编排入口：唤醒 -> 破绽 -> 长文生成并落库
    const summary = await dailyPackCron.runDailyPackCronJob(db, targetUserId);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n===========================================================');
    console.log(` 🎉 后台 02:00 作业模拟完成！总耗时: ${durationSec} 秒`);
    console.log('===========================================================');
    console.log(' 执行结果统计:', JSON.stringify(summary, null, 2));

    // 2. 针对指定用户或全库做精细落地校验
    const uid = targetUserId ? dailyPackService.normalizeUserId(targetUserId) : null;
    const articleCount = uid 
      ? db.prepare('SELECT COUNT(*) AS count FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ?').get(uid, packDate)
      : db.prepare('SELECT COUNT(*) AS count FROM daily_extracted_articles WHERE quota_date = ?').get(packDate);
      
    const packCount = uid
      ? db.prepare('SELECT COUNT(*) AS count FROM daily_packs WHERE user_id = ? AND pack_date = ?').get(uid, packDate)
      : db.prepare('SELECT COUNT(*) AS count FROM daily_packs WHERE pack_date = ?').get(packDate);

    console.log('\n📊 数据库今日落地统计:');
    if (uid) console.log(` - 目标用户: ${uid}`);
    console.log(` - daily_packs (唤醒与破绽记录数): ${packCount?.count || 0}`);
    console.log(` - daily_extracted_articles (今日持久化长文数): ${articleCount?.count || 0}`);
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n ❌ 后台作业执行出现异常:', err);
  } finally {
    db.close();
  }
}

main();
