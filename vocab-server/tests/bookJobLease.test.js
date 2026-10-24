const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { initBookCore } = require('../services/bookService');
const { createBookJobService } = require('../services/bookJobService');
const { createHeavyResourceGate } = require('../services/heavyResourceGate');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-job-lease-'));
  const file = path.join(root, 'jobs.db');
  const db = new Database(file);
  initBookCore(db);
  const jobs = createBookJobService(db, options);
  const now = Date.now();
  db.prepare(`INSERT INTO books (id,owner_id,title,original_file_name,status,created_at,updated_at)
    VALUES ('book-a','alice','A','a.txt','pending',?,?)`).run(now, now);
  return { db, jobs, file, close() { db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

function insertJob(db, id, status = 'pending', createdAt = Date.now(), extra = {}) {
  db.prepare(`INSERT INTO book_jobs
    (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,lease_token,lease_expires_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, 'book-a', 'alice', 'parse', status, extra.stage || 'queued', extra.key || id,
      extra.token || null, extra.expiresAt || null, createdAt);
}

test('事务领取确保并发 worker 仅一个获得同一任务', () => {
  const f = fixture({ leaseMs: 1000 });
  const peer = new Database(f.file);
  const peerJobs = createBookJobService(peer, { leaseMs: 1000 });
  try {
    insertJob(f.db, 'job-1', 'pending', 1);
    const first = f.jobs.claimNext({ now: 100 });
    const second = peerJobs.claimNext({ now: 100 });
    assert.equal(first.id, 'job-1');
    assert.equal(second, null);
    assert.ok(first.leaseToken);
    assert.equal(first.leaseExpiresAt, 1100);
  } finally { peer.close(); f.close(); }
});

test('claimNext 可按 jobType 过滤，未传时保持通用领取', () => {
  const f = fixture();
  try {
    insertJob(f.db, 'framework-first', 'pending', 1);
    f.db.prepare("UPDATE book_jobs SET job_type='framework' WHERE id='framework-first'").run();
    insertJob(f.db, 'parse-second', 'pending', 2);
    assert.equal(f.jobs.claimNext({ now: 100, jobType: 'parse' }).id, 'parse-second');
    assert.equal(f.db.prepare("SELECT status FROM book_jobs WHERE id='framework-first'").get().status, 'pending');
    assert.equal(f.jobs.claimNext({ now: 101 }).id, 'framework-first');
  } finally { f.close(); }
});

test('错误 lease 不能 heartbeat 或 finish，当前 lease 可以', () => {
  const f = fixture({ leaseMs: 1000 });
  try {
    insertJob(f.db, 'job-1');
    const lease = f.jobs.claimNext({ now: 100 });
    assert.equal(f.jobs.heartbeat('job-1', 'wrong', { now: 200 }), false);
    assert.equal(f.jobs.finish('job-1', 'wrong', { now: 200 }), false);
    assert.equal(f.jobs.heartbeat('job-1', lease.leaseToken, { now: 200 }), true);
    assert.equal(f.jobs.finish('job-1', lease.leaseToken, { now: 300 }), true);
    assert.equal(f.db.prepare('SELECT status FROM book_jobs WHERE id=?').get('job-1').status, 'completed');
  } finally { f.close(); }
});

test('仅 lease 过期 running 可接管，启动仅恢复过期任务', () => {
  const f = fixture({ leaseMs: 1000 });
  try {
    insertJob(f.db, 'expired', 'running', 1, { token: 'old', expiresAt: 99 });
    insertJob(f.db, 'active', 'running', 2, { token: 'live', expiresAt: 101 });
    assert.equal(f.jobs.recoverExpired({ now: 100 }), 1);
    assert.equal(f.db.prepare('SELECT status FROM book_jobs WHERE id=?').get('expired').status, 'retrying');
    assert.equal(f.db.prepare('SELECT status FROM book_jobs WHERE id=?').get('active').status, 'running');
    const claimed = f.jobs.claimNext({ now: 100 });
    assert.equal(claimed.id, 'expired');
    assert.notEqual(claimed.leaseToken, 'old');
  } finally { f.close(); }
});

test('步骤按 job/type/input 幂等且 completed 不重复执行', () => {
  const f = fixture();
  try {
    insertJob(f.db, 'job-1');
    const first = f.jobs.ensureStep({ jobId: 'job-1', stepType: 'extract', inputHash: 'hash-a' });
    const duplicate = f.jobs.ensureStep({ jobId: 'job-1', stepType: 'extract', inputHash: 'hash-a' });
    assert.equal(first.id, duplicate.id);
    f.jobs.completeStep(first.id, { outputPath: '/private/output.json' });
    const completed = f.jobs.ensureStep({ jobId: 'job-1', stepType: 'extract', inputHash: 'hash-a' });
    assert.equal(completed.status, 'completed');
    assert.equal(f.db.prepare('SELECT count(*) n FROM book_job_steps').get().n, 1);
    initBookCore(f.db);
    assert.equal(f.db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name='book_job_steps'").get().n, 1);
  } finally { f.close(); }
});

test('全局 heavy gate 同时仅运行一个任务', async () => {
  const gate = createHeavyResourceGate({ inspect: () => ({ availableMemory: Infinity, swapUsed: 0, loadAverage: 0 }) });
  let active = 0;
  let maximum = 0;
  const run = () => gate.run(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 20));
    active -= 1;
  });
  await Promise.all([run(), run(), run()]);
  assert.equal(maximum, 1);
});
