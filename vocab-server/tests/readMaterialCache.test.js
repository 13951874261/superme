const assert = require('node:assert/strict');
const test = require('node:test');
const cache = require('../services/readMaterialCacheService');
const cronRuns = require('../services/dailyCronRunService');

function openDb() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(':memory:');
  }
}

test('全部 4×3 阅读组合持久化且精确匹配', async () => {
  const db = openDb();
  let calls = 0;
  const result = await cache.generateAllForUser(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12',
    generateFn: async ({ sceneType, sceneFramework }) => {
      calls += 1;
      return `${sceneType}-${sceneFramework}-${'内容'.repeat(800)}`;
    },
    evaluateFn: () => ({ quality: 'ok', charCount: 1600 }),
  });
  assert.equal(result.ready, 12);
  assert.equal(calls, 12);
  assert.equal(cache.get(db, { userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'book', sceneFramework: 'corp' }).status, 'ready');
  assert.equal(cache.get(db, { userId: 'lmy', theme: '商务谈判', packDate: '2026-09-12', sceneType: 'book', sceneFramework: 'corp' }).status, 'missing');
  assert.equal(cache.get(db, { userId: 'other', theme: '危机公关', packDate: '2026-09-12', sceneType: 'book', sceneFramework: 'corp' }).status, 'missing');
});

test('夜间任务为指定活跃账号生成全部组合', async () => {
  const db = openDb();
  const result = await cache.runDailyCron(db, {
    users: [{ user_id: 'lmy', theme: '危机公关' }],
    generateFn: async ({ sceneType, sceneFramework }) => `${sceneType}-${sceneFramework}\n甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`,
  });
  assert.equal(result.users, 1);
  assert.equal(result.results[0].ready, 12);
});

test('默认质量门禁拒绝只有长度没有细节和利益方的素材', async () => {
  const db = openDb();
  await cache.generateOne(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => '空泛内容'.repeat(500),
  });
  assert.equal(cache.get(db, { userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov' }).status, 'failed');
});

test('全部组合使用有界并发且不超过配置上限', async () => {
  const db = openDb();
  let active = 0;
  let peak = 0;
  const result = await cache.generateAllForUser(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', concurrency: 2,
    generateFn: async ({ sceneType, sceneFramework }) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return `${sceneType}-${sceneFramework}\n甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  });
  assert.equal(result.ready, 12);
  assert.equal(peak, 2);
});

test('夜间阅读任务按账号记录失败状态并保留缺失项供补跑', async () => {
  const db = openDb();
  cronRuns.initDailyCronRunTables(db);
  const tick = cronRuns.createCronTickId();
  const run = cronRuns.createPerUserRun(db, { cronTickId: tick, userId: 'lmy', packDate: '2026-09-12', triggerSource: 'cron', unitTotal: 12 });
  const result = await cache.runDailyCron(db, {
    cronTickId: tick,
    users: [{ user_id: 'lmy', theme: '危机公关' }],
    generateFn: async ({ sceneType }) => {
      if (sceneType === 'book') return '短';
      return `甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  });
  assert.equal(result.results[0].failed, 3);
  const step = cronRuns.findStep(db, { runId: run.id, module: 'read_material' });
  assert.equal(step.status, 'failed');
  assert.match(step.error_message, /failed=3/);
  const aggregated = cronRuns.getRunByTickUser(db, tick, 'lmy');
  assert.equal(JSON.parse(aggregated.summary_json).unitTotal, 13);
});

test('白天缓存未命中时生成并回写，后续请求直接复用', async () => {
  const db = openDb();
  let calls = 0;
  const input = {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => {
      calls += 1;
      return `甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  };
  const first = await cache.getOrGenerate(db, input);
  const second = await cache.getOrGenerate(db, input);
  assert.equal(first.status, 'ready');
  assert.equal(second.status, 'ready');
  assert.equal(calls, 1);
});

test('同键并发未命中只生成一次', async () => {
  const db = openDb();
  let calls = 0;
  const input = {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  };
  const [first, second] = await Promise.all([cache.getOrGenerate(db, input), cache.getOrGenerate(db, input)]);
  assert.equal(first.status, 'ready');
  assert.equal(second.status, 'ready');
  assert.equal(calls, 1);
});

test('不合格素材最多尝试三次并持久化失败', async () => {
  const db = openDb();
  let calls = 0;
  await cache.generateOne(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => { calls += 1; return '短'; },
    evaluateFn: () => ({ quality: 'below_standard', charCount: 1 }),
  });
  assert.equal(calls, 3);
  assert.equal(cache.get(db, { userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov' }).status, 'failed');
});
