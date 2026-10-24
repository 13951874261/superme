const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const dailyPackService = require('../services/dailyPackService');
const dailyListenPreGenerateService = require('../services/dailyListenPreGenerateService');

const targetUser = process.argv[2] || 'user_f0b1d8aa-fd4b-4a07-a97f-777d2a9a0625';
const packDate = dailyPackService.getPackDate();
const dbPath = path.join(__dirname, '../vocab.db');
const db = new Database(dbPath);

console.log(`\n================ 正在为用户 [${targetUser}] 模拟 2:00 AM (仅 1 分钟 duration=1) 流水线 ================`);

(async () => {
  // 1. 唤醒包与破绽包生成
  console.log('\n[1/3] 检查/准备每日唤醒与破绽词汇包...');
  const themeRow = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(targetUser);
  const theme = themeRow?.theme || '商务谈判：让步与施压';
  try {
    await dailyPackService.generateDailyPackForUser(db, targetUser, theme, 'cron');
    console.log(' ✅ 每日唤醒与破绽词汇包就绪');
  } catch (e) {
    console.warn(' ⚠️ 唤醒包跳过/忽略网络超时:', e.message);
  }

  // 2. 长文 1 分钟组合预生成
  console.log('\n[2/3] 预生成所有题材与难度的 1 分钟长文组合 (duration=1)...');
  const GENRES = ['meeting', 'news', 'podcast', 'reading'];
  const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];

  let articleOk = 0;
  for (const genre of GENRES) {
    for (const cefrLevel of CEFR_LEVELS) {
      try {
        await dailyPackService.generateLongArticleForUser(db, targetUser, theme, 'cron', genre, cefrLevel, '1');
        articleOk++;
      } catch (e) {
        console.warn(` ⚠️ 组合 ${genre}/${cefrLevel}/1m 异常:`, e.message);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  console.log(` ✅ 1 分钟长文预生成完成: ${articleOk}/${GENRES.length * CEFR_LEVELS.length} 组合`);

  // 3. 长文文本直接复用，批量合成 1 分钟精听音频
  console.log('\n[3/3] 批次复用 1 分钟长文文本，合成精听盲听 .mp3 音频...');
  const syncRes = await dailyListenPreGenerateService.batchSyncAudiosFromLongArticles(db, targetUser, packDate);
  console.log(` ✅ 1 分钟精听音频合成完成: ${syncRes.success} 个音频文件落库`);

  console.log('\n================ 1 分钟 02:00 定时任务模拟结束 ====================\n');
})().catch(err => {
  console.error('模拟失败:', err);
});
