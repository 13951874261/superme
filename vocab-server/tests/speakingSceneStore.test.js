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
  getDailyAllocation,
  initPersonalizedSpeakingSceneTable,
  listSpeakingScenes,
  nextSpeakingScene,
  recordSpeakingSceneUse,
  saveSpeakingScene,
} = require('../services/personalizedSpeakingSceneService');

const multiRole = (n) => ({
  title: `Negotiation ${n}`, background: 'A team must make a difficult choice.',
  roles: [
    { name: 'Lead A', identity: 'Product lead', stance: 'Prefer option A', roleType: 'ally' },
    { name: 'Lead B', identity: 'Sales lead', stance: 'Prefer option B', roleType: 'blocker' },
  ],
  conflict: `Only one option can win ${n}.`, objective: 'Reach agreement.',
  tasks: ['Explain priorities', 'Offer a compromise'], opening: 'Let us decide today.',
});
const impromptu = (n) => ({
  topic: `Public speaking ${n}`, background: 'A department meeting needs a recommendation.',
  identity: 'Team lead', audience: 'Colleagues', objective: 'Recommend one action.',
  conflict: `Speed conflicts with quality ${n}.`, structure: ['Position', 'Reasons', 'Conclusion'],
  points: ['Feedback helps', 'Limits reduce risk'], keywords: ['feedback', 'risk'],
  opening: 'The fastest choice is not always careless.',
});

function openDb() {
  const db = new Database(':memory:');
  initPersonalizedSpeakingSceneTable(db);
  return db;
}

function save(db, { userId = 'u1', date = '2026-09-03', type = 'multi_role', n, currentSceneId, now = n }) {
  return saveSpeakingScene(db, {
    id: `${userId}-${type}-${n}`, userId, sceneDate: date, sceneType: type,
    content: type === 'multi_role' ? multiRole(n) : impromptu(n),
    profileHash: `profile-${n}`, currentSceneId, now,
  });
}

test('缓存表：单表、约束及用户当天内容 hash 去重', () => {
  const db = openDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'personalized_speaking_scenes'").all();
  assert.equal(tables.length, 1);
  save(db, { n: 1 });
  assert.throws(() => saveSpeakingScene(db, {
    id: 'duplicate', userId: 'u1', sceneDate: '2026-09-03', sceneType: 'multi_role',
    content: { ...multiRole(1) }, profileHash: 'different-profile', now: 2,
  }), /重复/);
  assert.equal(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' }).length, 1);
  db.close();
});

test('缓存配额：默认 5+5；按最近 7 个 scene_date 聚合且各限制 2..8', () => {
  const db = openDb();
  assert.deepEqual(getDailyAllocation(db, { userId: 'u1', sceneDate: '2026-09-03' }), { multi_role: 5, impromptu: 5 });
  for (let day = 27; day <= 31; day += 1) {
    save(db, { date: `2026-08-${day}`, type: 'multi_role', n: day, now: day });
    recordSpeakingSceneUse(db, { userId: 'u1', sceneId: `u1-multi_role-${day}`, now: Date.UTC(2026, 7, day, 12) });
  }
  save(db, { date: '2026-09-01', type: 'impromptu', n: 1, now: 40 });
  recordSpeakingSceneUse(db, { userId: 'u1', sceneId: 'u1-impromptu-1', now: Date.UTC(2026, 8, 1, 12) });
  save(db, { date: '2026-08-20', type: 'impromptu', n: 20, now: 41 });
  for (let n = 0; n < 20; n += 1) {
    recordSpeakingSceneUse(db, { userId: 'u1', sceneId: 'u1-impromptu-20', now: Date.UTC(2026, 8, 3, 12) + n });
  }
  assert.deepEqual(getDailyAllocation(db, { userId: 'u1', sceneDate: '2026-09-03' }), { multi_role: 8, impromptu: 2 });
  db.close();
});

test('缓存日期：拒绝无效日历日期并接受闰日', () => {
  const db = openDb();
  assert.throws(() => save(db, { date: '2026-02-31', n: 1 }), /sceneDate/);
  assert.throws(() => save(db, { date: '2026-13-01', n: 2 }), /sceneDate/);
  assert.throws(() => save(db, { date: '2025-02-29', n: 3 }), /sceneDate/);
  assert.equal(save(db, { date: '2024-02-29', n: 4 }).sceneDate, '2024-02-29');
  db.close();
});

test('缓存类型配额：未满总上限时仍拒绝超过当日类型目标', () => {
  const db = openDb();
  for (let n = 1; n <= 5; n += 1) save(db, { n });
  assert.throws(() => save(db, { n: 6 }), /类型配额.*5/);
  assert.equal(save(db, { type: 'impromptu', n: 1, now: 10 }).sceneType, 'impromptu');
  assert.equal(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' }).length, 6);
  db.close();
});

test('缓存存储：每用户每日两类合计最多 10，用户之间隔离', () => {
  const db = openDb();
  for (let n = 1; n <= 5; n += 1) save(db, { n });
  for (let n = 1; n <= 5; n += 1) save(db, { type: 'impromptu', n, now: n + 10 });
  assert.throws(() => save(db, { n: 11 }), /10/);
  assert.throws(() => db.prepare(`INSERT INTO personalized_speaking_scenes
    (id, user_id, scene_date, scene_type, content_json, content_hash, profile_hash, created_at, updated_at)
    SELECT 'direct-11', user_id, scene_date, scene_type, content_json, 'direct-hash', profile_hash, 99, 99
    FROM personalized_speaking_scenes WHERE id = 'u1-multi_role-1'`).run(), /10/);
  save(db, { userId: 'u2', n: 11 });
  assert.equal(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' }).length, 10);
  assert.deepEqual(listSpeakingScenes(db, { userId: 'u2', sceneDate: '2026-09-03' }).map((row) => row.id), ['u2-multi_role-11']);
  assert.throws(() => recordSpeakingSceneUse(db, { userId: 'u2', sceneId: 'u1-multi_role-1', now: 99 }), /不存在/);
  db.close();
});

test('缓存轮换：next 循环选择并记录 use', () => {
  const db = openDb();
  const first = save(db, { n: 1, now: 1 });
  const second = save(db, { n: 2, now: 2 });
  assert.equal(nextSpeakingScene(db, { userId: 'u1', sceneDate: '2026-09-03', sceneType: 'multi_role' }).id, first.id);
  recordSpeakingSceneUse(db, { userId: 'u1', sceneId: first.id, now: 10 });
  assert.equal(nextSpeakingScene(db, { userId: 'u1', sceneDate: '2026-09-03', sceneType: 'multi_role', currentSceneId: first.id }).id, second.id);
  recordSpeakingSceneUse(db, { userId: 'u1', sceneId: second.id, now: 11 });
  assert.equal(nextSpeakingScene(db, { userId: 'u1', sceneDate: '2026-09-03', sceneType: 'multi_role', currentSceneId: second.id }).id, first.id);
  assert.equal(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' })[0].useCount, 1);
  db.close();
});

test('缓存替换：未满插入；满额仅原位替换指定当前项', () => {
  const db = openDb();
  for (let n = 1; n <= 5; n += 1) save(db, { n });
  for (let n = 1; n <= 5; n += 1) save(db, { type: 'impromptu', n, now: n + 10 });
  const replaced = save(db, { n: 99, currentSceneId: 'u1-multi_role-3', now: 99 });
  const rows = listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' });
  assert.equal(rows.length, 10);
  assert.equal(replaced.id, 'u1-multi_role-3');
  assert.equal(replaced.content.title, 'Negotiation 99');
  assert.throws(() => save(db, { n: 100, currentSceneId: 'u1-impromptu-1', now: 100 }), /类型/);
  db.close();
});

test('缓存写入：校验失败、插入失败或替换失败均不改变已有数据', () => {
  const db = openDb();
  save(db, { n: 1 });
  const before = listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' });
  assert.throws(() => saveSpeakingScene(db, {
    id: 'bad', userId: 'u1', sceneDate: '2026-09-03', sceneType: 'multi_role',
    content: { ...multiRole(2), roles: [] }, profileHash: 'p', now: 2,
  }), /roles/);
  assert.deepEqual(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' }), before);

  db.exec(`CREATE TRIGGER abort_scene_insert BEFORE INSERT ON personalized_speaking_scenes
    BEGIN SELECT RAISE(ABORT, 'forced insert failure'); END`);
  assert.throws(() => save(db, { type: 'impromptu', n: 2, now: 2 }), /forced insert failure/);
  assert.deepEqual(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' }), before);
  db.exec('DROP TRIGGER abort_scene_insert');

  for (let n = 2; n <= 5; n += 1) save(db, { n });
  for (let n = 1; n <= 5; n += 1) save(db, { type: 'impromptu', n, now: n + 10 });
  const fullBefore = listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' });
  db.exec(`CREATE TRIGGER abort_scene_update BEFORE UPDATE ON personalized_speaking_scenes
    BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);
  assert.throws(() => saveSpeakingScene(db, {
    id: 'new', userId: 'u1', sceneDate: '2026-09-03', sceneType: 'multi_role',
    content: multiRole(99), profileHash: 'p3', currentSceneId: 'u1-multi_role-1', now: 99,
  }));
  assert.deepEqual(listSpeakingScenes(db, { userId: 'u1', sceneDate: '2026-09-03' }), fullBefore);
  db.close();
});
