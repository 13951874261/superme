const path = require('path');
const Database = require('better-sqlite3');
const dailyPackService = require('../services/dailyPackService');

// 关联 SQLite 数据库
const dbPath = path.join(__dirname, '..', 'vocab.db');
let db;
try {
  db = new Database(dbPath);
} catch (e) {
  console.log('SKIP test-generate-flaw (better-sqlite3 native bindings unavailable)');
  process.exit(0);
}

// 初始化 daily_packs 与 user_theme_prefs 表结构
dailyPackService.initDailyPackTables(db);

// 解析命令行参数中的 userId (--userId=xxx)
const args = process.argv.slice(2);
let userId = 'user_6f33882d-3363-4e8b-877b-f4c5ace73176';

args.forEach((arg) => {
  if (arg.startsWith('--userId=')) {
    userId = arg.split('=')[1];
  }
});

async function runManualFlawGeneration() {
  console.log('==================================================');
  console.log(`[Manual Trigger] 开始为目标用户准备每日破绽词汇...`);
  console.log(`- 目标 User ID: ${userId}`);
  console.log('==================================================\n');

  // 1. 提取用户在数据库中的真实关联参数
  const packDate = dailyPackService.getPackDate();
  const themeRow = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(userId);
  const userTheme = themeRow ? themeRow.theme : '商务谈判攻防与条款谈判';

  const historyExclude = dailyPackService.getHistoryExclude(db);
  const userCurrentProfile = dailyPackService.getUserCurrentProfile(db, userId);

  console.log('>>> 1. 提取到的用户真实上下文参数:');
  console.log(` - 用户设置主题 (userTheme): "${userTheme}"`);
  console.log(` - 排除的历史已学词汇 (historyExclude): [${historyExclude || '无'}]`);
  console.log(` - 用户高管侧写 (userCurrentProfile): "${userCurrentProfile || '未配置(使用默认侧写)'}"\n`);

  // 2. 计算稳定输入签名并写状态为 generating
  const inputSignature = dailyPackService.computeInputSignature(userTheme, historyExclude, userCurrentProfile);
  dailyPackService.upsertDailyPack(db, {
    userId,
    packDate,
    theme: userTheme,
    inputSignature,
    wakeup: null,
    flawVocab: null,
    source: 'manual_script',
    status: 'generating',
    errorMessage: null,
  });
  console.log('>>> 2. 状态已更新为 [generating]，正在呼叫 Dify 工作流推演破绽词汇...');

  // 3. 实时呼叫 Dify 工作流生成 6 个破绽词汇
  try {
    const flawVocab = await dailyPackService.generateFlawVocabForUser(db, userId, userTheme);

    console.log('\n>>> 3. Dify 工作流推演完成！成功获得破绽词汇:');
    if (Array.isArray(flawVocab) && flawVocab.length > 0) {
      flawVocab.forEach((item, index) => {
        console.log(`   [${index + 1}] ${item.word} (${item.ipa}) - ${item.meaning_zh}`);
        console.log(`       解析: ${item.pronunciation_note}`);
        console.log(`       例句: ${item.example}`);
      });
    } else {
      console.warn('   ⚠️ Dify 返回词汇为空，已使用备用本地破绽词汇降级处理。');
    }

    // 4. 将结果持久化更新至 SQLite daily_packs 表
    const existingRow = dailyPackService.getDailyPackRow(db, userId, packDate, inputSignature);
    const existingWakeup = existingRow && existingRow.wakeup_json ? JSON.parse(existingRow.wakeup_json) : null;

    const savedRow = dailyPackService.upsertDailyPack(db, {
      userId,
      packDate,
      theme: userTheme,
      inputSignature,
      wakeup: existingWakeup,
      flawVocab,
      source: 'manual_script',
      status: 'ready',
      errorMessage: null,
    });

    console.log('\n>>> 4. 数据库落库校验结果:');
    console.log(` - 落库用户 (user_id): ${savedRow.user_id}`);
    console.log(` - 包日期 (pack_date): ${savedRow.pack_date}`);
    console.log(` - 缓存状态 (status): ${savedRow.status}`);
    console.log(` - 存储来源 (source): ${savedRow.source}`);
    console.log(` - 破绽词数据大小: ${savedRow.flaw_vocab_json ? savedRow.flaw_vocab_json.length : 0} 字节`);
    console.log('\n✅ 手动触发与生成写入成功！现在用户在前台登录后，打开“每日破绽词汇推送”模块即可直接秒级呈现。');
  } catch (error) {
    console.error('\n❌ 手动触发推演失败:', error.message);
    dailyPackService.upsertDailyPack(db, {
      userId,
      packDate,
      theme: userTheme,
      inputSignature,
      wakeup: null,
      flawVocab: null,
      source: 'manual_script',
      status: 'failed',
      errorMessage: error.message,
    });
  } finally {
    db.close();
  }
}

runManualFlawGeneration();
