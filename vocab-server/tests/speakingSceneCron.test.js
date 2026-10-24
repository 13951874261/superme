const test = require('node:test');
const assert = require('node:assert/strict');
const BetterSqlite3 = require('better-sqlite3');
function Database(path) {
  try { return new BetterSqlite3(path); } catch (nativeError) {
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); } catch { throw nativeError; }
    const db = new DatabaseSync(path);
    db.transaction = (work) => (...args) => {
      db.exec('BEGIN IMMEDIATE');
      try { const result = work(...args); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    };
    return db;
  }
}
const {
  initPersonalizedSpeakingSceneTable,
  listSpeakingScenes,
  runSpeakingSceneCronForUser,
  saveSpeakingScene,
} = require('../services/personalizedSpeakingSceneService');

const multi = (n) => ({
  title: `M${n}`, background: 'Background', roles: [
    { name: 'A', identity: 'A lead', stance: 'A', roleType: 'ally' }, { name: 'B', identity: 'B lead', stance: 'B', roleType: 'blocker' },
  ], conflict: `C${n}`, objective: 'Agree', tasks: ['Speak'], opening: 'Start',
});
const impromptu = (n) => ({
  topic: `I${n}`, background: 'Background', identity: 'Lead', audience: 'Team', objective: 'Persuade',
  conflict: `C${n}`, structure: ['Open', 'Close'], points: ['Point'], keywords: ['word'], opening: 'Start',
});

function openDb() {
  const db = new Database(':memory:');
  initPersonalizedSpeakingSceneTable(db);
  return db;
}

function save(db, type, n) {
  return saveSpeakingScene(db, {
    id: `${type}-${n}`, userId: 'u1', sceneDate: '2026-09-03', sceneType: type,
    content: type === 'multi_role' ? multi(n) : impromptu(n), profileHash: 'h', now: n,
  });
}

test('Cron 按动态分配补足两类，合计不超过 10', async () => {
  const db = openDb();
  save(db, 'multi_role', 1);
  save(db, 'impromptu', 1);
  const calls = [];
  const result = await runSpeakingSceneCronForUser({
    db, userId: 'u1', sceneDate: '2026-09-03',
    generate: async ({ sceneType, count }) => {
      calls.push({ sceneType, count });
      return Array.from({ length: count }, (_, i) => sceneType === 'multi_role' ? multi(i + 10) : impromptu(i + 10));
    },
  });
  assert.deepEqual(calls, [{ sceneType: 'multi_role', count: 4 }, { sceneType: 'impromptu', count: 4 }]);
  assert.equal(result.generated, 8);
  assert.equal(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' }).length, 10);
  db.close();
});

test('Cron 5+4 仅补一个剩余槽位，不尝试第 11 条', async () => {
  const db = openDb();
  for (let i = 1; i <= 5; i += 1) save(db, 'multi_role', i);
  for (let i = 1; i <= 4; i += 1) save(db, 'impromptu', i);
  const calls = [];
  const result = await runSpeakingSceneCronForUser({
    db, userId: 'u1', sceneDate: '2026-09-03',
    generate: async ({ sceneType, count }) => {
      calls.push({ sceneType, count });
      return [sceneType === 'multi_role' ? multi(99) : impromptu(99)];
    },
  });
  assert.deepEqual(calls, [{ sceneType: 'impromptu', count: 1 }]);
  assert.equal(result.total, 10);
  db.close();
});

test('Cron 两类受控并发且单类失败不阻断另一类', async () => {
  const db = openDb();
  let active = 0;
  let maxActive = 0;
  const result = await runSpeakingSceneCronForUser({
    db, userId: 'u1', sceneDate: '2026-09-03',
    generate: async ({ sceneType, count }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      if (sceneType === 'multi_role') throw new Error('multi failed');
      return Array.from({ length: count }, (_, i) => impromptu(i + 20));
    },
  });
  assert.equal(maxActive, 2);
  assert.equal(result.generated, 5);
  assert.deepEqual(result.failedTypes, ['multi_role']);
  db.close();
});

test('生成器审计日志真实只记录画像 present/length/hash', async () => {
  const logs = [];
  const { createSpeakingSceneGenerator } = require('../services/personalizedSpeakingSceneService');
  const generate = createSpeakingSceneGenerator({
    logger: { info(...args) { logs.push(args); }, error(...args) { logs.push(args); } },
    runWorkflow: async () => ({ data: { status: 'succeeded', outputs: { result: JSON.stringify([multi(1)]) } } }),
  });
  const db = { prepare: () => ({ get: () => ({ profile_content: 'PRIVATE PROFILE', memory_layers: '{}', error_ledger: '{}' }) }) };
  await generate({ db, userId: 'u1', sceneType: 'multi_role', count: 1 });
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /PRIVATE PROFILE/);
  assert.match(serialized, /profile_present/);
  assert.match(serialized, /profile_length/);
  assert.match(serialized, /profile_hash/);
});
