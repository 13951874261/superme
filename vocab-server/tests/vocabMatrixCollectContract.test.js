const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relPath) => fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const hookSource = read('src/hooks/useVocabCollect.ts');
const dashboardSource = read('src/components/modules/english/tabs/DashboardTab.tsx');
const gridSource = read('src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx');
const briefingSource = read('src/components/modules/english/tabs/dashboard/IntelBriefing.tsx');
const wakeupSource = read('src/components/modules/DailyWakeupModule.tsx');
const flawSource = read('src/components/modules/DailyErrorVocabularyModule.tsx');

// 1. 收录路径必须落在统一的矩阵补齐函数上（同步端点 + 后台任务共用）
assert.match(serverSource, /app\.post\('\/api\/vocab\/add-enriched'/, '缺少单条收录并补齐矩阵的同步端点');
assert.match(serverSource, /async function runVocabEntryEnrichment/, '缺少矩阵补齐核心实现');
assert.ok(
  serverSource.includes('const result = await enrichAndPersistVocabEntry({\n              userId,'),
  '后台批量任务必须复用同一套矩阵补齐逻辑'
);
assert.match(serverSource, /inflightVocabEnrichment/, '缺少进行中去重，3 秒竞速会重复生成矩阵');
assert.match(serverSource, /DELETE FROM vocabulary WHERE id = \?/, '矩阵生成失败必须回滚，避免留下无矩阵的半成品词条');

// 2. 三类词条（单词/短语/句式）都必须走矩阵补齐
assert.match(serverSource, /vocabMatrixEnricher\.classifyKind/, '缺少词/短语/句式口径判定');
assert.match(serverSource, /vocabMatrixEnricher\.generateVocabMatrix/, '缺少矩阵正文生成调用');
assert.match(serverSource, /vocabMatrixEnricher\.runMemoryAidWorkflow/, '缺少记忆辅助与记忆节点生成');
assert.match(serverSource, /INSERT INTO vocabulary[\s\S]{0,600}?ease_factor/, '入库必须初始化 SM-2 字段');

// 3. 3 秒竞速托管机制集中在共享 hook 内，且三处调用点复用同一实现
assert.match(hookSource, /VOCAB_COLLECT_RACE_MS = 3000/, '必须保留 3 秒竞速阈值');
assert.match(hookSource, /addVocabWithTimeout\(action, VOCAB_COLLECT_RACE_MS\)/, '收录必须走 3 秒竞速');
assert.match(hookSource, /addWordEnriched\(/, '收录必须调用矩阵补齐端点');
assert.match(hookSource, /batchAddWordsAsync\(/, '超时后必须转入后台异步任务');
assert.match(hookSource, /type: 'vocab_add'/, '超时任务必须登记到任务中心');
assert.match(hookSource, /任务中心/, '超时提示必须引导用户前往任务中心');

for (const [name, source] of [['长文进度总控', dashboardSource], ['每日唤醒', wakeupSource], ['每日破绽', flawSource]]) {
  assert.match(source, /useVocabCollect\(/, `${name} 必须复用统一收录 hook`);
}

// 4. 布局 A：只保留逐条「+ 收录」，不得存在任何批量入口
for (const banned of ['一键全量收录', '批量收录生词', '批量收录短语', '批量收录句型', 'handleBatchAddCategory', 'handleBatchAddAll']) {
  assert.ok(!gridSource.includes(banned), `词句面板不得包含批量入口: ${banned}`);
  assert.ok(!briefingSource.includes(banned), `情报简报不得转发批量入口: ${banned}`);
  assert.ok(!dashboardSource.includes(banned), `进度总控不得保留批量入口: ${banned}`);
}
assert.strictEqual((gridSource.match(/\+ 收录/g) || []).length, 3, '生词/短语/句式三区必须各有一个逐条收录按钮');

// 5. 三条生成链路都不得自动入库，入库只能由用户逐条点击触发
assert.ok(!/batchAddWords\(/.test(dashboardSource), '长文提纯不得批量自动落库');
assert.ok(!/\baddWord\(/.test(dashboardSource), '长文翻译缓存不得静默写入生词本');
assert.ok(!/\baddWord\(/.test(wakeupSource), '唤醒词条不得自动写入生词本');
assert.ok(!/\baddWord\(/.test(flawSource), '破绽词条不得绕过矩阵补齐直接写入生词本');
assert.match(wakeupSource, /handleCollectWord/, '唤醒模块必须提供逐条收录入口');
assert.match(flawSource, /collect\(\{/, '破绽模块必须走统一收录入口');

// 6. 自动翻译缓存写入的历史词条不得被当作已收录，否则矩阵永远无法补齐
assert.match(dashboardSource, /isVocabMatrixReady/, '缺少矩阵完整性判定');
assert.match(dashboardSource, /matrixReady: isVocabMatrixReady\(payload\)/, '词条详情需暴露矩阵完整性');
assert.strictEqual(
  (gridSource.match(/vocabDetailsMap\[cleanKey\]\?\.matrixReady/g) || []).length,
  3,
  '三区的已收录状态都必须依据矩阵是否齐备'
);

console.log('vocab matrix collect contract tests passed');
