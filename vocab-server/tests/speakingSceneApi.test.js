const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
process.env.NODE_ENV = 'test';
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
const taskQueue = require('../services/taskQueue');
const {
  createSpeakingSceneApiRouter,
  initPersonalizedSpeakingSceneTable,
  listSpeakingScenes,
  saveSpeakingScene,
} = require('../services/personalizedSpeakingSceneService');

const scene = (n) => ({
  title: `Scene ${n}`, background: 'A real business decision.',
  roles: [
    { name: 'A', identity: 'Lead A', stance: 'Choose A', roleType: 'ally' },
    { name: 'B', identity: 'Lead B', stance: 'Choose B', roleType: 'blocker' },
  ],
  conflict: `Conflict ${n}`, objective: 'Agree.', tasks: ['Explain'], opening: `Open ${n}`,
});

function save(db, userId, n, date = '2026-09-03') {
  return saveSpeakingScene(db, {
    id: `${userId}-${n}`, userId, sceneDate: date, sceneType: 'multi_role',
    content: scene(n), profileHash: 'hash', now: n,
  });
}

async function fixture({ generate } = {}) {
  process.env.NODE_ENV = 'test';
  const db = new Database(':memory:');
  initPersonalizedSpeakingSceneTable(db);
  const app = express();
  app.use(express.json());
  app.use('/api/english/speaking-scenes', createSpeakingSceneApiRouter({
    db,
    taskQueue,
    generate: generate || (async () => [scene(99)]),
    getSceneDate: () => '2026-09-03',
  }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/english/speaking-scenes`;
  return { db, base, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function readFirstBusinessEvent(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    const match = /event: scene\ndata: (.+)\n\n/.exec(text);
    if (match) return JSON.parse(match[1]);
  }
  return null;
}

function clearTasks() {
  taskQueue.tasks.clear();
  taskQueue._save();
}

test.beforeEach(clearTasks);
test.after(clearTasks);

test('GET 保留完整 trim userId，邮箱不同域隔离，/:sceneId/use 不可跨用户', async () => {
  const f = await fixture();
  save(f.db, 'alice@example.com', 1);
  save(f.db, 'alice@other.com', 2);
  save(f.db, 'bob', 3);
  const list = await fetch(`${f.base}?userId=${encodeURIComponent(' alice@example.com ')}`).then((r) => r.json());
  assert.deepEqual(list.scenes.map((item) => item.id), ['alice@example.com-1']);
  const other = await fetch(`${f.base}?userId=${encodeURIComponent('alice@other.com')}`).then((r) => r.json());
  assert.deepEqual(other.scenes.map((item) => item.id), ['alice@other.com-2']);
  const denied = await fetch(`${f.base}/bob-2/use`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'alice@example.com' }),
  });
  assert.equal(denied.status, 404);
  await f.close();
});

test('switch 三场景严格按 A→B→C→A 轮换且不重复计 use', async () => {
  const f = await fixture();
  const userId = 'alice@example.com';
  for (let index = 1; index <= 3; index += 1) save(f.db, userId, index);
  let currentSceneId = `${userId}-1`;
  const visited = [];
  for (let index = 0; index < 3; index += 1) {
    const response = await fetch(`${f.base}/switch`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, sceneType: 'multi_role', currentSceneId }),
    });
    const payload = await readFirstBusinessEvent(response);
    currentSceneId = payload.scene.id;
    visited.push(currentSceneId);
  }
  assert.deepEqual(visited, [`${userId}-2`, `${userId}-3`, `${userId}-1`]);
  assert.deepEqual(
    listSpeakingScenes(f.db, { userId, sceneDate: '2026-09-03' }).map((item) => item.useCount),
    [0, 0, 0],
  );
  await f.close();
});

test('switch 缓存命中：30次采样 P95<300ms 并记录 max', async () => {
  const f = await fixture();
  save(f.db, 'alice@example.com', 1);
  save(f.db, 'alice@example.com', 2);
  const samples = [];
  for (let index = 0; index < 30; index += 1) {
    const started = performance.now();
    const response = await fetch(`${f.base}/switch`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'alice@example.com', sceneType: 'multi_role', currentSceneId: 'alice@example.com-1' }),
    });
    const payload = await readFirstBusinessEvent(response);
    samples.push(performance.now() - started);
    assert.equal(response.headers.get('cache-control'), 'no-cache, no-transform');
    assert.equal(response.headers.get('x-accel-buffering'), 'no');
    assert.equal(payload.scene.id, 'alice@example.com-2');
  }
  const sorted = samples.toSorted((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  const max = sorted.at(-1);
  assert.ok(p95 < 300, `P95=${p95}ms max=${max}ms`);
  assert.ok(Number.isFinite(max), `max=${max}`);
  await f.close();
});

test('switch 缓存 miss：不清除当前场景，返回后台任务', async () => {
  let release;
  const f = await fixture({ generate: () => new Promise((resolve) => { release = resolve; }) });
  const current = save(f.db, 'alice', 1);
  const response = await fetch(`${f.base}/switch`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'alice', sceneType: 'impromptu', currentSceneId: current.id }),
  });
  const body = await response.text();
  const event = JSON.parse(/event: task\ndata: (.+)\n\n/.exec(body)[1]);
  assert.ok(event.taskId);
  assert.equal(listSpeakingScenes(f.db, { userId: 'alice', sceneDate: '2026-09-03' })[0].id, current.id);
  release([]);
  await f.close();
});

test('场景任务查询按归一化 userId 隔离', async () => {
  let release;
  const f = await fixture({ generate: () => new Promise((resolve) => { release = resolve; }) });
  const created = await fetch(`${f.base}/regenerate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'alice@example.com', sceneType: 'multi_role' }),
  }).then((r) => r.json());
  assert.equal(taskQueue.getTask(created.taskId).userId, 'alice@example.com');
  assert.equal((await fetch(`${f.base}/tasks/${created.taskId}?userId=bob`)).status, 404);
  assert.equal((await fetch(`${f.base}/tasks/${created.taskId}?userId=alice@example.com`)).status, 200);
  release([scene(50)]);
  await f.close();
});

test('regenerate 并发复用同一 task；失败后原场景不变', async () => {
  let rejectWork;
  const f = await fixture({ generate: () => new Promise((_, reject) => { rejectWork = reject; }) });
  const current = save(f.db, 'alice', 1);
  const request = () => fetch(`${f.base}/regenerate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'alice@example.com', sceneType: 'multi_role', currentSceneId: current.id }),
  }).then((r) => r.json());
  const [a, b] = await Promise.all([request(), request()]);
  assert.equal(a.taskId, b.taskId);
  rejectWork(new Error('upstream failed'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(taskQueue.getTask(a.taskId).status, 'failed');
  assert.deepEqual(listSpeakingScenes(f.db, { userId: 'alice', sceneDate: '2026-09-03' })[0].content, current.content);
  await f.close();
});
