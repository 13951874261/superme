/**
 * FV-CRON-03：精听失败不得把整次 run 标成 completed；健康度必须 degraded。
 * 运行：node vocab-server/tests/cronListenNoFalseComplete.test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const svc = require('../services/dailyCronRunService');

function openDatabase(filePath) {
  try {
    const Database = require('better-sqlite3');
    return new Database(filePath);
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(filePath);
  }
}

function openDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-listen-status-'));
  const db = openDatabase(path.join(dir, 't.db'));
  svc.initDailyCronRunTables(db);
  return { db, dir };
}

function testResolveListenTerminalStatus() {
  assert.strictEqual(
    typeof svc.resolveListenTerminalStatus,
    'function',
    '必须导出 resolveListenTerminalStatus，重跑不得无条件 completed',
  );
  assert.strictEqual(
    svc.resolveListenTerminalStatus({ combosFail: 1, existingStatus: 'completed' }),
    'failed',
    '内部 combosFail>0 即使外层想写成 completed 也必须 failed',
  );
  assert.strictEqual(
    svc.resolveListenTerminalStatus({ combosFail: 0, existingStatus: 'failed' }),
    'failed',
    '内部已标 failed 不得改成 completed',
  );
  assert.strictEqual(
    svc.resolveListenTerminalStatus({ thrown: true, combosFail: 0 }),
    'failed',
  );
  assert.strictEqual(
    svc.resolveListenTerminalStatus({ combosFail: 0, existingStatus: 'completed' }),
    'completed',
  );
  console.log('OK resolveListenTerminalStatus');
}

function testListenFailedRunNotCompleted() {
  const { db, dir } = openDb();
  try {
    const run = svc.createPerUserRun(db, {
      cronTickId: svc.createCronTickId(),
      userId: 'lzhmy',
      packDate: '2026-08-22',
    });
    svc.upsertStep(db, {
      runId: run.id, userId: 'lzhmy', module: 'wakeup',
      status: 'completed', progress: 100, finishedAt: Date.now(),
    });
    svc.upsertStep(db, {
      runId: run.id, userId: 'lzhmy', module: 'flaw',
      status: 'completed', progress: 100, finishedAt: Date.now(),
    });
    svc.upsertStep(db, {
      runId: run.id, userId: 'lzhmy', module: 'listen',
      status: 'failed', progress: 100, finishedAt: Date.now(),
      errorMessage: 'combosFail=1',
    });
    const row = svc.refreshRunAggregation(db, run.id, { unitTotal: 3 });
    assert.notStrictEqual(row.status, 'completed', '有 failed 步不得 completed');
    assert.strictEqual(row.execution_status, 'partial_failed');
    assert.strictEqual(row.audit_health, 'degraded', '健康度必须直接写成 degraded');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('OK listen failed → not completed + degraded');
}

function testRerunDoesNotForceListenCompleted() {
  const serverSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(
    serverSrc,
    /resolveListenTerminalStatus/,
    'user_rerun 必须以内部结果决定精听终态',
  );
  const allCurrent = serverSrc.match(
    /if \(mode === 'all_current'\) \{[\s\S]*?\} else \{/,
  );
  assert.ok(allCurrent, '找不到 all_current 重跑块');
  assert.doesNotMatch(
    allCurrent[0],
    /module:\s*'listen',\s*status:\s*'completed'/,
    'all_current 不得无条件把 listen 写成 completed',
  );
  console.log('OK rerun source does not force listen completed');
}

function main() {
  testResolveListenTerminalStatus();
  testListenFailedRunNotCompleted();
  testRerunDoesNotForceListenCompleted();
  console.log('All cronListenNoFalseComplete tests passed');
}

main();
