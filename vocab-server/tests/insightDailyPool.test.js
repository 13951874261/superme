const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getFallbackDraft, buildScenarioResponse } = require('../services/insightScenarioScript');
const pool = require('../services/insightDailyPoolService');

test('server 只读池路由且 scenario 复用 generateInsightScenario', () => {
  const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(src, /app\.get\('\/api\/insight\/listen\/pool'/);
  assert.match(src, /generateInsightScenario/);
  assert.doesNotMatch(src, /maxAttempts = 3/);
});

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

test('normalizeCategory 对齐职场文案', () => {
  assert.equal(pool.normalizeCategory('体制内职场'), '体制内');
  assert.equal(pool.normalizeCategory('外企职场'), '外企');
  assert.equal(pool.normalizeCategory('通用社交'), '通用社交');
});

test('GET 池只读：空池不生成，写入后按日返回', async () => {
  const db = openDb();
  const empty = pool.getPool(db, { userId: 'u1', category: '体制内职场', packDate: '2026-08-23' });
  assert.equal(empty.readyCount, 0);
  assert.equal(empty.cases.length, 0);
  assert.equal(empty.category, '体制内');

  let n = 0;
  await pool.storeGenerated(db, {
    userId: 'u1',
    packDate: '2026-08-23',
    category: '体制内',
    generateFn: async () => {
      n += 1;
      return fakePayload('体制内', `局内试探 ${n}`);
    },
  });
  const filled = pool.getPool(db, { userId: 'u1', category: '体制内', packDate: '2026-08-23' });
  assert.equal(filled.readyCount, 1);
  assert.equal(n, 1);
  assert.equal(filled.cases[0].draft.sceneTitle, '局内试探 1');
});

test('30 天指纹去重：同用户同类撞库会再生成', async () => {
  const db = openDb();
  const same = fakePayload('外企', '同一标题');
  let calls = 0;
  const generateFn = async () => {
    calls += 1;
    if (calls === 1) return same;
    if (calls === 2) return same;
    return fakePayload('外企', '新标题');
  };

  await pool.storeGenerated(db, {
    userId: 'u1',
    packDate: '2026-08-01',
    category: '外企',
    generateFn: async () => same,
  });
  const second = await pool.storeGenerated(db, {
    userId: 'u1',
    packDate: '2026-08-20',
    category: '外企',
    generateFn,
  });
  assert.ok(calls >= 2, '撞指纹必须再调一次生成');
  assert.notEqual(second.draft.sceneTitle, '同一标题');
});

test('fallback 不入库，避免假 10/10', async () => {
  const db = openDb();
  const row = await pool.storeGenerated(db, {
    userId: 'u1',
    packDate: '2026-08-23',
    category: '体制内',
    generateFn: async () => ({ ...fakePayload('体制内', '内置兜底'), source: 'fallback' }),
  });
  assert.equal(row, null);
  assert.equal(pool.countReady(db, 'u1', '2026-08-23', '体制内'), 0);
});

test('LS-POOL-03: 连续两日各 10 套指纹不撞，超 30 天可复用；过期行清理', async () => {
  const db = openDb();
  let i = 0;
  const generateFn = async ({ category }) => {
    i += 1;
    return fakePayload(category, `社交-${i}`);
  };
  const day1 = await pool.fillCategory(db, {
    userId: 'u1', packDate: '2026-08-01', category: '通用社交', generateFn,
  });
  const day2 = await pool.fillCategory(db, {
    userId: 'u1', packDate: '2026-08-02', category: '通用社交', generateFn,
  });
  assert.equal(day1.ready.length, 10);
  assert.equal(day2.ready.length, 10);
  const fps1 = new Set(day1.ready.map((c) => c.fingerprint));
  const fps2 = new Set(day2.ready.map((c) => c.fingerprint));
  assert.equal(fps1.size, 10);
  for (const fp of fps2) assert.equal(fps1.has(fp), false);

  const reused = await pool.storeGenerated(db, {
    userId: 'u1',
    packDate: '2026-09-01',
    category: '通用社交',
    generateFn: async () => fakePayload('通用社交', '社交-1'),
  });
  assert.equal(reused.draft.sceneTitle, '社交-1');

  const deleted = pool.pruneExpired(db, '2026-09-01', 30);
  assert.ok(deleted >= 10);
  assert.equal(pool.countReady(db, 'u1', '2026-08-01', '通用社交'), 0);
});

test('fillCategory 补到 10 套且不同用户互不影响', async () => {
  const db = openDb();
  let i = 0;
  const generateFn = async ({ category }) => {
    i += 1;
    return fakePayload(category, `${category}-${i}`);
  };
  const a = await pool.fillCategory(db, {
    userId: 'alice',
    packDate: '2026-08-23',
    category: '通用社交',
    generateFn,
  });
  assert.equal(a.ready.length, 10);
  const b = pool.getPool(db, { userId: 'bob', category: '通用社交', packDate: '2026-08-23' });
  assert.equal(b.readyCount, 0);
});
