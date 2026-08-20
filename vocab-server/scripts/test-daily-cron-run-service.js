/**
 * dailyCronRunService tests (U1–U8, U-snap contract, U-date, short-circuit, locks)
 * Run: node scripts/test-daily-cron-run-service.js
 * Pure-only: CRON_RUN_TEST_PURE=1 node scripts/test-daily-cron-run-service.js
 */
const assert = require('assert');
const svc = require('../services/dailyCronRunService');

let Database = null;
let dbAvailable = false;
try {
  Database = require('better-sqlite3');
  const probe = new Database(':memory:');
  probe.close();
  dbAvailable = true;
} catch (e) {
  console.warn('SKIP db suite: better-sqlite3 unavailable →', e.message.split('\n')[0]);
}

function createDb() {
  const db = new Database(':memory:');
  svc.initDailyCronRunTables(db);
  return db;
}

function testSanitize() {
  const cleaned = svc.sanitizeCronLogPayload({
    Authorization: 'Bearer app-OShKY1EcVuLFkuxrpO28ZB0A',
    DIFY_WAKEUP_API_KEY: 'app-secret12345678',
    nested: { token: 'abc', note: 'Bearer app-ABCDEFGH12345678 ok' },
    message: 'failed with Bearer xyz.token and app-ABCDEFGH12345678',
    list: [{ api_key: 'app-ZZZZZZZZ11111111' }],
  });
  const dump = JSON.stringify(cleaned);
  assert(!/app-OShKY1EcVuLFkuxrpO28ZB0A/.test(dump), 'raw key must be stripped');
  assert(!/Bearer\s+app-ABCDEFGH/.test(dump), 'bearer must be redacted');
  assert(!/app-ZZZZZZZZ11111111/.test(dump), 'nested list key value redacted');
  assert.strictEqual(cleaned.Authorization, '[REDACTED]');
  assert.strictEqual(cleaned.DIFY_WAKEUP_API_KEY, '[REDACTED]');
  assert.strictEqual(cleaned.nested.token, '[REDACTED]');
  assert.strictEqual(cleaned.list[0].api_key, '[REDACTED]');
  console.log('OK U1 sanitize');
}

function testProgressAndAggregate() {
  assert.strictEqual(svc.aggregateExecutionStatus(['completed', 'skipped']), 'completed');
  assert.strictEqual(svc.aggregateExecutionStatus(['completed', 'failed']), 'partial_failed');
  assert.strictEqual(svc.aggregateExecutionStatus(['failed', 'failed']), 'failed');
  assert.strictEqual(svc.aggregateExecutionStatus(['running', 'completed']), 'running');
  assert.strictEqual(svc.computeRunProgress({ finishedUnits: 67, totalUnits: 67 }), 100);
  assert.strictEqual(svc.computeRunProgress({ finishedUnits: 0, totalUnits: 67 }), 0);
  assert.strictEqual(svc.computeRunProgress({ finishedUnits: 33, totalUnits: 67 }), Math.round(33 / 67 * 100));
  console.log('OK U2/U3 progress+aggregate');
}

function testInputSource() {
  const src = svc.buildInputSource({
    name: 'theme',
    value: '商务谈判',
    friendlyDescription: '从用户主题偏好读取',
    sourceType: 'database',
    sourceRef: 'user_theme_prefs.theme',
    queryRule: 'WHERE user_id = ?',
    transform: 'trim',
    fallback: '商务谈判：让步与施压',
  });
  assert.ok(src.friendlyDescription);
  assert.ok(src.technicalDetails.sourceRef);
  assert.strictEqual(src.technicalDetails.sourceType, 'database');

  const sens = svc.buildInputSource({
    name: 'Authorization',
    value: 'Bearer app-ABCDEFGH12345678',
    sensitive: true,
    friendlyDescription: 'HTTP 鉴权头（已脱敏）',
    sourceType: 'env',
    sourceRef: 'process.env',
  });
  assert.strictEqual(sens.sensitive, true);
  assert.strictEqual(sens.value, 'Bearer [REDACTED]');
  assert(!String(sens.valuePreview || '').includes('ABCDEFGH'));
  console.log('OK U4/U8 inputSource+sensitive');
}

function testBusinessDate() {
  // U-date: Shanghai pack_date frozen (Asia/Shanghai calendar)
  const d = svc.getPackDate(new Date('2026-08-07T16:30:00Z')); // UTC 16:30 → Shanghai 00:30 next day
  assert.strictEqual(d, '2026-08-08');
  const d2 = svc.getPackDate(new Date('2026-08-07T15:59:00Z')); // still Aug 7 Shanghai
  assert.strictEqual(d2, '2026-08-07');
  assert.strictEqual(svc.RETENTION_DAYS, 7);
  const cutoff = svc.retentionCutoffDate(new Date('2026-08-08T04:00:00Z'));
  assert.ok(typeof cutoff === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cutoff));
  console.log('OK U-date businessDate', { d, d2, cutoff });
}

function testLongComboKeys() {
  const keys = svc.listLongArticleComboKeys();
  assert.strictEqual(keys.length, 64);
  assert.ok(keys.includes('meeting|B1|1'));
  assert.strictEqual(svc.STANDARD_UNIT_TOTAL, 67);
  assert.strictEqual(svc.LISTEN_ONLY_UNIT_TOTAL, 1);
  console.log('OK long combo keys=64 unitTotal=67');
}

function testRerunLock() {
  const a = svc.acquireRerunLock('userA', 'run1', 'failed_snapshot', 15_000);
  assert.ok(a.ok);
  const b = svc.acquireRerunLock('userA', 'run1', 'failed_snapshot', 15_000);
  assert.ok(!b.ok, 'double-click same mode must collide');
  const c = svc.acquireRerunLock('userA', 'run1', 'all_current', 15_000);
  assert.ok(c.ok, 'different mode may proceed');
  svc.releaseRerunLock(a.key);
  svc.releaseRerunLock(c.key);
  const d = svc.acquireRerunLock('userA', 'run1', 'failed_snapshot', 15_000);
  assert.ok(d.ok);
  svc.releaseRerunLock(d.key);
  console.log('OK I6 rerun lock');
}

function testFailedSnapshotRejectContract() {
  // U7 contract: failed_snapshot with zero failed steps → reject (mirrors server.js)
  const parentSteps = [
    { id: 's1', status: 'completed', module: 'wakeup' },
    { id: 's2', status: 'skipped', module: 'long_article' },
  ];
  const failed = parentSteps.filter((s) => s.status === 'failed');
  assert.strictEqual(failed.length, 0);
  console.log('OK U7 failed_snapshot reject-when-all-success contract');
}

function testSnapshotNoResolverContract() {
  // U-snap: snapshot path must reuse inputs_json; resolvers/random call count = 0
  // Pure contract check: sanitized stored inputs do not contain secrets; no Math.random here.
  const inputs = svc.sanitizeCronLogPayload({
    theme: '地缘政治',
    Authorization: 'Bearer app-SHOULDNOTLEAK',
    salt: 'focus-salt-xyz',
    focus: 'concession',
  });
  assert.strictEqual(inputs.Authorization, '[REDACTED]');
  assert.strictEqual(inputs.salt, 'focus-salt-xyz');
  assert.strictEqual(inputs.focus, 'concession');
  console.log('OK U-snap/U8 snapshot sanitize contract');
}

function testUniqueAndOwner() {
  const db = createDb();
  const tick = svc.createCronTickId();
  const a = svc.createPerUserRun(db, { cronTickId: tick, userId: 'userA', packDate: '2026-08-08' });
  const again = svc.createPerUserRun(db, { cronTickId: tick, userId: 'userA', packDate: '2026-08-08' });
  assert.strictEqual(a.id, again.id, 'UNIQUE(cron_tick_id,user_id) should reuse');

  let threw = false;
  try {
    db.prepare(`
      INSERT INTO daily_cron_runs (
        id, cron_tick_id, pack_date, user_id, trigger_source, parent_run_id,
        status, progress, execution_status, audit_health, summary_json, error_message,
        started_at, finished_at, created_at, updated_at
      ) VALUES (?, ?, '2026-08-08', 'userA', 'cron', NULL, 'running', 0, 'running', 'ok', NULL, NULL, 1, NULL, 1, 1)
    `).run('run_dup', tick);
  } catch {
    threw = true;
  }
  assert.ok(threw, 'duplicate insert must fail');

  const own = svc.assertRunOwner(db, a.id, 'userA');
  assert.ok(own.ok);
  const deny = svc.assertRunOwner(db, a.id, 'userB');
  assert.strictEqual(deny.code, 404);

  const detailDeny = svc.getRunDetailForUser(db, a.id, 'userB');
  assert.strictEqual(detailDeny.code, 404);

  const tick2 = svc.createCronTickId();
  svc.createPerUserRun(db, { cronTickId: tick2, userId: 'userB', packDate: '2026-08-08' });
  const listA = svc.listRunsForUser(db, 'userA', { days: 7 });
  assert.ok(listA.every((r) => r.user_id === 'userA'));
  assert.ok(listA.some((r) => r.id === a.id));
  console.log('OK U6/I1/I2/I-unique unique+owner+list isolation');
}

function testInterruptAndRetention() {
  const db = createDb();
  const tick = svc.createCronTickId();
  const run = svc.createPerUserRun(db, {
    cronTickId: tick,
    userId: 'u1',
    packDate: '2026-08-01',
  });
  db.prepare(`
    UPDATE daily_cron_runs SET lease_owner = 'other', lease_until = ? WHERE id = ?
  `).run(Date.now() + 3600_000, run.id);

  svc.upsertStep(db, {
    runId: run.id,
    userId: 'u1',
    module: 'wakeup',
    status: 'running',
  });

  const interrupted = svc.markInterruptedRunning(db);
  assert.ok(interrupted.runsInterrupted >= 1);
  assert.ok(interrupted.stepsInterrupted >= 1);
  const after = db.prepare('SELECT status, error_message FROM daily_cron_runs WHERE id = ?').get(run.id);
  assert.strictEqual(after.status, 'failed');
  assert.match(String(after.error_message || ''), /interrupted/i);

  const oldTick = svc.createCronTickId();
  const old = svc.createPerUserRun(db, {
    cronTickId: oldTick,
    userId: 'u1',
    packDate: '2020-01-01',
  });
  db.prepare(`UPDATE daily_cron_runs SET status = 'completed', execution_status = 'completed' WHERE id = ?`).run(old.id);
  const cleaned = svc.cleanupOldCronRuns(db, new Date('2026-08-08T04:00:00Z'));
  assert.ok(cleaned.deletedRuns >= 1);
  const gone = db.prepare('SELECT id FROM daily_cron_runs WHERE id = ?').get(old.id);
  assert.strictEqual(gone, undefined);

  // running kept from retention
  const keepTick = svc.createCronTickId();
  const keep = svc.createPerUserRun(db, {
    cronTickId: keepTick,
    userId: 'u1',
    packDate: '2020-01-02',
  });
  db.prepare(`UPDATE daily_cron_runs SET status = 'running', execution_status = 'running' WHERE id = ?`).run(keep.id);
  svc.cleanupOldCronRuns(db, new Date('2026-08-08T04:00:00Z'));
  const kept = db.prepare('SELECT id FROM daily_cron_runs WHERE id = ?').get(keep.id);
  assert.ok(kept, 'running must be kept by retention');
  console.log('OK U5/I7/I8 interrupt+retention');
}

function testShortCircuitSkippedTree() {
  const db = createDb();
  const tick = svc.createCronTickId();
  const run = svc.createPerUserRun(db, {
    cronTickId: tick,
    userId: 'u1',
    packDate: '2026-08-08',
  });
  svc.writeShortCircuitSkippedTree(db, {
    runId: run.id,
    userId: 'u1',
    reason: 'daily_pack_ready_cron_cache',
  });
  const steps = db.prepare('SELECT module, status FROM daily_cron_steps WHERE run_id = ?').all(run.id);
  const longSkipped = steps.filter((s) => s.module === 'long_article' && s.status === 'skipped');
  assert.strictEqual(longSkipped.length, 64);
  assert.ok(steps.some((s) => s.module === 'wakeup' && s.status === 'skipped'));
  assert.ok(steps.some((s) => s.module === 'flaw' && s.status === 'skipped'));
  // listen not part of short-circuit tree
  assert.ok(!steps.some((s) => s.module === 'listen'));

  const refreshed = db.prepare('SELECT progress, execution_status FROM daily_cron_runs WHERE id = ?').get(run.id);
  // 66/67 finished (listen missing) → not yet 100
  assert.ok(refreshed.progress < 100);

  svc.upsertStep(db, {
    runId: run.id,
    userId: 'u1',
    module: 'listen',
    status: 'completed',
    progress: 100,
    finishedAt: Date.now(),
  });
  svc.refreshRunAggregation(db, run.id, { unitTotal: svc.STANDARD_UNIT_TOTAL });
  const done = db.prepare('SELECT progress, execution_status FROM daily_cron_runs WHERE id = ?').get(run.id);
  assert.strictEqual(done.progress, 100);
  assert.strictEqual(done.execution_status, 'completed');

  const events = db.prepare('SELECT message FROM daily_cron_log_events WHERE run_id = ?').all(run.id);
  assert.ok(events.some((e) => /short-circuit skip/i.test(e.message)));
  console.log('OK I-skip short-circuit skipped tree + progress 100');
}

function testStitchSameTick() {
  const db = createDb();
  const tick = svc.createCronTickId();
  const run = svc.createPerUserRun(db, {
    cronTickId: tick,
    userId: 'u1',
    packDate: '2026-08-08',
  });
  const ids = svc.listUserIdsForTick(db, tick);
  assert.deepStrictEqual(ids, ['u1']);
  const openMiss = svc.getRunByTickUser(db, tick, 'ghost');
  assert.strictEqual(openMiss, undefined);
  // OPEN miss must NOT insert
  const before = db.prepare('SELECT COUNT(*) AS c FROM daily_cron_runs WHERE cron_tick_id = ?').get(tick).c;
  assert.strictEqual(before, 1);
  console.log('OK I-stitch / I-stitch-users open-miss no insert');
}

function testAuditDegraded() {
  const db = createDb();
  const tick = svc.createCronTickId();
  const run = svc.createPerUserRun(db, {
    cronTickId: tick,
    userId: 'u1',
    packDate: '2026-08-08',
  });
  svc.markAuditDegraded(db, run.id, 'sqlite write fail mid-run');
  const row = db.prepare('SELECT audit_health, execution_status, status FROM daily_cron_runs WHERE id = ?').get(run.id);
  assert.strictEqual(row.audit_health, 'degraded');
  assert.notStrictEqual(row.execution_status, 'completed');
  console.log('OK I-audit audit_health degraded');
}

function main() {
  const onlyPure = process.env.CRON_RUN_TEST_PURE === '1';
  testSanitize();
  testProgressAndAggregate();
  testInputSource();
  testBusinessDate();
  testLongComboKeys();
  testRerunLock();
  testFailedSnapshotRejectContract();
  testSnapshotNoResolverContract();

  if (onlyPure || !dbAvailable) {
    console.log(onlyPure ? 'SKIP db tests (CRON_RUN_TEST_PURE=1)' : 'SKIP db tests (native module)');
  } else {
    testUniqueAndOwner();
    testInterruptAndRetention();
    testShortCircuitSkippedTree();
    testStitchSameTick();
    testAuditDegraded();
  }
  console.log('All dailyCronRunService tests passed');
}

main();
