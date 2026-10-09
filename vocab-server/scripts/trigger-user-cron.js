const Database = require('better-sqlite3');
const path = require('path');
const dailyPackCron = require('../services/dailyPackCron');
const dailyPackService = require('../services/dailyPackService');

const targetUser = process.argv[2] || 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

dailyPackService.initDailyPackTables(db);

console.log(`\n================ 正在触发用户 [${targetUser}] 2:00 流水线生成 ================`);

(async () => {
  const summary = await dailyPackCron.runDailyPackCronJob(db, targetUser);
  console.log('\n流水线执行结果 Summary:', summary);
  console.log('\n========================================================================\n');
})().catch(err => {
  console.error('触发失败:', err);
});
