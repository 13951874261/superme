const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cron = fs.readFileSync(path.join(__dirname, '../services/dailyPackCron.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const BetterSqlite3 = require('better-sqlite3');
function Database(pathname) {
  try { return new BetterSqlite3(pathname); } catch (nativeError) {
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); } catch { throw nativeError; }
    return new DatabaseSync(pathname);
  }
}

test('dailyPackCron 审计快照不保存画像原文，签名仍使用真实画像', () => {
  assert.match(cron, /computeInputSignature\([\s\S]*userCurrentProfile/);
  const snapshot = /const inputsSnapshot = \{([\s\S]*?)\n    \};/.exec(cron)?.[1] || '';
  assert.doesNotMatch(snapshot, /user_current_profile\s*:/);
  assert.match(snapshot, /profile_present/);
  assert.match(snapshot, /profile_length/);
  assert.match(snapshot, /profile_hash/);
});

test('dailyPackCron 实际 unitTotal 包含 wakeup/flaw/long/speaking/listen', () => {
  assert.match(cron, /unitTotal:\s*combos\.length\s*\+\s*4/);
  assert.match(cron, /refreshRunAggregation\(db, run\.id, \{ unitTotal \}\)/);
});

test('dailyListen 聚合读取 run 已保存动态 unitTotal', () => {
  const listen = fs.readFileSync(path.join(__dirname, '../services/dailyListenPreGenerateService.js'), 'utf8');
  assert.match(listen, /getRunUnitTotal\(\s*run/);
  assert.match(listen, /refreshRunAggregation\(db, run\.id, \{ unitTotal \}\)/);
});

test('Cron run 保留完整 trim userId，并隔离邮箱不同域', () => {
  const svc = require('../services/dailyCronRunService');
  const db = new Database(':memory:');
  svc.initDailyCronRunTables(db);
  const first = svc.createPerUserRun(db, { cronTickId: 'tick-email', userId: ' alice@example.com ', packDate: '2026-09-03' });
  const second = svc.createPerUserRun(db, { cronTickId: 'tick-email', userId: 'alice@other.com', packDate: '2026-09-03' });
  assert.notEqual(first.id, second.id);
  assert.equal(first.user_id, 'alice@example.com');
  assert.equal(second.user_id, 'alice@other.com');
  assert.equal(svc.getRunByTickUser(db, 'tick-email', 'alice@example.com').id, first.id);
  assert.equal(svc.getRunByTickUser(db, 'tick-email', 'alice@other.com').id, second.id);
  assert.equal(svc.assertRunOwner(db, first.id, 'alice@other.com').ok, false);
  db.close();
});

test('动态 unitTotal 与实际步骤数一致后 run 完成', () => {
  const svc = require('../services/dailyCronRunService');
  const db = new Database(':memory:');
  svc.initDailyCronRunTables(db);
  const run = svc.createPerUserRun(db, { cronTickId: 'tick-real', userId: 'u1', packDate: '2026-09-03', unitTotal: 5 });
  for (const module of ['wakeup', 'flaw', 'long_article', 'speaking_scene', 'listen']) {
    svc.upsertStep(db, { runId: run.id, userId: 'u1', module, status: 'completed', progress: 100, finishedAt: Date.now() });
  }
  assert.equal(svc.refreshRunAggregation(db, run.id).status, 'completed');
  db.close();
});

test('dailyPackCron 用户级并发池为 2', () => {
  assert.match(cron, /await mapPool\(users,\s*2,\s*async \(row\)/);
});

test('speaking_scene 共享结果判定：失败类型优先，满额零生成跳过', () => {
  const svc = require('../services/personalizedSpeakingSceneService');
  assert.deepEqual(svc.determineSpeakingSceneStepOutcome({ generated: 0, total: 10, failedTypes: [] }), { status: 'skipped', errorMessage: null });
  assert.deepEqual(svc.determineSpeakingSceneStepOutcome({ generated: 1, total: 10, failedTypes: ['impromptu'] }), { status: 'failed', errorMessage: 'failed types: impromptu' });
  assert.deepEqual(svc.determineSpeakingSceneStepOutcome({ generated: 2, total: 10, failedTypes: [] }), { status: 'completed', errorMessage: null });
  assert.match(cron, /determineSpeakingSceneStepOutcome/);
  assert.match(server, /determineSpeakingSceneStepOutcome/g);
});

test('Cron 重跑显式支持 speaking_scene，未知模块失败', () => {
  assert.match(server, /module:\s*['"]speaking_scene['"]/);
  assert.match(server, /fs\.module === ['"]speaking_scene['"]/);
  assert.match(server, /if \(fs\.module !== ['"]listen['"] && fs\.module !== ['"]speaking_scene['"]\)/);
  assert.match(server, /throw new Error\(`unknown cron module:/);
});
