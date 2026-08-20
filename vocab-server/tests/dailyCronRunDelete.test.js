const assert = require('assert');

function openDatabase() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.transaction = (fn) => (...args) => {
      db.exec('BEGIN');
      try {
        const result = fn(...args);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    };
    return db;
  }
}

const svc = require('../services/dailyCronRunService');

function seedFinishedRun(db, { userId = 'u1', status = 'completed' } = {}) {
  const run = svc.createPerUserRun(db, {
    cronTickId: svc.createCronTickId(),
    userId,
    packDate: '2026-08-20',
    triggerSource: 'cron',
  });
  db.prepare(`
    UPDATE daily_cron_runs
    SET status = ?, execution_status = ?, progress = 100, finished_at = ?
    WHERE id = ?
  `).run(status, status, Date.now(), run.id);
  svc.upsertStep(db, {
    runId: run.id,
    userId,
    module: 'wakeup',
    status: status === 'failed' ? 'failed' : 'completed',
    progress: 100,
  });
  svc.appendLogEvent(db, { runId: run.id, level: 'info', message: 'seed' });
  return run.id;
}

function testDeleteCascades() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const id = seedFinishedRun(db, { status: 'partial_failed' });
  const r = svc.deleteRunForUser(db, id, 'u1');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(id).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_steps WHERE run_id = ?').get(id).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_log_events WHERE run_id = ?').get(id).n, 0);
}

function testDeleteRunning409() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const run = svc.createPerUserRun(db, {
    cronTickId: svc.createCronTickId(),
    userId: 'u1',
    packDate: '2026-08-20',
  });
  const r = svc.deleteRunForUser(db, run.id, 'u1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 409);
}

function testDeleteWrongUser404() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const id = seedFinishedRun(db, { userId: 'u1' });
  const r = svc.deleteRunForUser(db, id, 'other');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 404);
}

function testDeleteMissing404() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const r = svc.deleteRunForUser(db, 'run_missing', 'u1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 404);
}

function testDeletePending409() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const id = seedFinishedRun(db, { status: 'completed' });
  db.prepare(`
    UPDATE daily_cron_runs
    SET status = 'pending', execution_status = 'pending', finished_at = NULL
    WHERE id = ?
  `).run(id);
  const r = svc.deleteRunForUser(db, id, 'u1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 409);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(id).n, 1);
}

function testClearFinishedScopedToUser() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const u1Done = seedFinishedRun(db, { userId: 'u1', status: 'completed' });
  const u2Done = seedFinishedRun(db, { userId: 'u2', status: 'failed' });
  const r = svc.clearFinishedRunsForUser(db, 'u1');
  assert.ok(r.deletedRuns >= 1);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(u1Done).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(u2Done).n, 1);
}

function testClearFinished() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const done = seedFinishedRun(db, { status: 'failed' });
  const run = svc.createPerUserRun(db, {
    cronTickId: svc.createCronTickId(),
    userId: 'u1',
    packDate: '2026-08-21',
  });
  const r = svc.clearFinishedRunsForUser(db, 'u1');
  assert.ok(r.deletedRuns >= 1);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(done).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(run.id).n, 1);
}

try {
  testDeleteCascades();
  testDeleteRunning409();
  testDeleteWrongUser404();
  testDeleteMissing404();
  testDeletePending409();
  testClearFinishedScopedToUser();
  testClearFinished();
  console.log('✅ dailyCronRunDelete.test.js 通过');
} catch (e) {
  console.error('❌', e);
  process.exit(1);
}
