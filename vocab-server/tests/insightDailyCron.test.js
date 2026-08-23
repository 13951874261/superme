const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getFallbackDraft, buildScenarioResponse } = require('../services/insightScenarioScript');
const cron = require('../services/insightDailyCron');
const pool = require('../services/insightDailyPoolService');

function openDb() {
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(':memory:');
  }
  pool.ensureTable(db);
  return db;
}

function fakePayload(category, title) {
  const draft = getFallbackDraft(category);
  draft.sceneTitle = title;
  draft.sceneSummary = `摘要:${title}`;
  return buildScenarioResponse({ draft, category, quality: 'ok' });
}

test('默认 cron 小时是 4 且不并进 02:00', () => {
  delete process.env.INSIGHT_DAILY_CRON_HOUR;
  assert.equal(cron.resolveInsightCronHour(), 4);
  const packCron = fs.readFileSync(path.join(__dirname, '../services/dailyPackCron.js'), 'utf8');
  assert.match(packCron, /return 2/);
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(server, /scheduleInsightDailyCron/);
  assert.match(server, /pool\/backfill/);
});

test('cron 对每个用户三类各补到 10 套', async () => {
  const db = openDb();
  let n = 0;
  const generateFn = async ({ category }) => {
    n += 1;
    return fakePayload(category, `${category}-${n}`);
  };
  const tasks = [];
  const taskQueue = {
    createTask(type, name) {
      const task = { id: 't1', type, name };
      tasks.push(task);
      return task;
    },
    updateTask() {},
  };
  const summary = await cron.runInsightDailyCronJob(db, {
    generateFn,
    listUsers: () => [{ user_id: 'u1' }],
    taskQueue,
    concurrency: 2,
  });
  assert.equal(summary.total, 3);
  assert.equal(summary.ok, 3);
  assert.equal(pool.getPool(db, { userId: 'u1', category: '体制内', packDate: summary.packDate }).readyCount, 10);
  assert.equal(pool.getPool(db, { userId: 'u1', category: '外企', packDate: summary.packDate }).readyCount, 10);
  assert.equal(pool.getPool(db, { userId: 'u1', category: '通用社交', packDate: summary.packDate }).readyCount, 10);
  assert.equal(tasks[0].type, 'insight_daily_cron');
});

test('backfill 在现有套数上再加 1', async () => {
  const db = openDb();
  let n = 0;
  const generateFn = async ({ category }) => {
    n += 1;
    return fakePayload(category, `bf-${n}`);
  };
  await pool.storeGenerated(db, {
    userId: 'u1',
    packDate: require('../services/dailyPackService').getPackDate(),
    category: '体制内',
    generateFn,
  });
  const result = await cron.runBackfill(db, { userId: 'u1', category: '体制内职场', generateFn });
  assert.equal(result.ready.length, 2);
  assert.equal(result.added.length, 1);
});

test('cron 全 fallback 记失败，不把空写入算成功', async () => {
  const db = openDb();
  const generateFn = async () => ({ source: 'fallback', draft: getFallbackDraft('体制内') });
  const summary = await cron.runInsightDailyCronJob(db, {
    generateFn,
    listUsers: () => [{ user_id: 'u1' }],
    concurrency: 2,
  });
  assert.equal(summary.ok, 0);
  assert.equal(summary.failed, 3);
  assert.equal(pool.getPool(db, { userId: 'u1', category: '体制内', packDate: summary.packDate }).readyCount, 0);
});

test('backfill 路由 0 新增标 failed', () => {
  const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(src, /未能写入新案例/);
  assert.match(src, /added === 0/);
});
