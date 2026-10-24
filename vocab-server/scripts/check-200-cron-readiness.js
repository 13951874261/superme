const Database = require('better-sqlite3');
const path = require('path');
const dailyPackCron = require('../services/dailyPackCron');
const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log('\n================ 02:00 AM 全套定时流水线具备情况诊断 ================');

console.log('\n1. 【环境变量与调度配置】');
console.log(' - DAILY_PACK_CRON_HOUR:', process.env.DAILY_PACK_CRON_HOUR || '2 (默认)');
console.log(' - DAILY_PACK_CRON_ENABLED:', process.env.DAILY_PACK_CRON_ENABLED !== 'false' ? '✅ 启用' : '❌ 禁用');
console.log(' - DAILY_LISTEN_CRON_ENABLED:', process.env.DAILY_LISTEN_CRON_ENABLED !== 'false' ? '✅ 启用' : '❌ 禁用');

console.log('\n2. 【核心服务与底层闭环函数具备情况】');
console.log(' - 步骤一&二: 每日唤醒 + 破绽词汇生成:', typeof dailyPackService.generateDailyPackForUser === 'function' ? '✅ 已具备' : '❌ Missing');
console.log(' - 步骤三: 多组合长文预生成流水线:', typeof dailyPackService.generateLongArticleForUser === 'function' ? '✅ 已具备' : '❌ Missing');
console.log(' - 步骤四: 批量复用长文合成精听音频:', typeof dailyListenPreGenerateService.batchSyncAudiosFromLongArticles === 'function' ? '✅ 已具备 (长文复用)' : '❌ Missing');
console.log(' - 步骤五: 精听盲听降级保底生成:', typeof dailyListenPreGenerateService.runDailyListenCronJob === 'function' ? '✅ 已具备' : '❌ Missing');

console.log('\n3. 【支持时长扩展】');
console.log(' - 当前精听与长文统一支持时长:', dailyListenPreGenerateService.DURATIONS.join('m, ') + 'm');

console.log('\n========================================================================\n');
