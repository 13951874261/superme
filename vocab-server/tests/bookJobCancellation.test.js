const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const Database = require('better-sqlite3');
const { initBookCore, createBookRouter } = require('../services/bookService');
const { createBookJobService } = require('../services/bookJobService');

function seed(db, { owner = 'alice', book = 'book-a', job = 'job-a', status = 'pending', createdAt = 1 } = {}) {
  db.prepare(`INSERT OR IGNORE INTO books (id,owner_id,title,original_file_name,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(book, owner, book, `${book}.txt`, 'pending', createdAt, createdAt);
  db.prepare(`INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(job, book, owner, 'parse', status, 'queued', `${book}-input`, createdAt);
}

async function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-job-api-'));
  const db = new Database(path.join(root, 'test.db'));
  initBookCore(db);
  const jobs = createBookJobService(db, options);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.auth = { userId: req.headers['x-user'] || 'alice' }; next(); });
  app.use('/api/books', createBookRouter({ db, storageRoot: path.join(root, 'books'), jobService: jobs }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { db, jobs, base: `http://127.0.0.1:${server.address().port}`, close() { server.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

async function request(f, method, pathName, user = 'alice') {
  return fetch(`${f.base}${pathName}`, { method, headers: { 'x-user': user } });
}

test('取消与完成使用条件更新，竞态只有一个终态胜出', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-job-race-'));
  const db = new Database(path.join(root, 'test.db'));
  try {
    initBookCore(db);
    const jobs = createBookJobService(db);
    seed(db);
    const lease = jobs.claimNext({ now: 100 });
    assert.equal(jobs.requestCancel('job-a', 'alice', 'book-a', { now: 101 }), true);
    assert.equal(jobs.finish('job-a', lease.leaseToken, { now: 102 }), false);
    assert.equal(db.prepare('SELECT status FROM book_jobs WHERE id=?').get('job-a').status, 'cancelled');
  } finally { db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('failed/cancelled retry 创建新任务，旧任务保持终态且重复请求幂等', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-job-retry-'));
  const db = new Database(path.join(root, 'test.db'));
  try {
    initBookCore(db);
    const jobs = createBookJobService(db);
    seed(db, { status: 'failed' });
    db.prepare(`UPDATE book_jobs SET error_type='parser',error_code='BROKEN',error_message='bad',
      lease_token='old',lease_expires_at=50 WHERE id='job-a'`).run();
    const first = jobs.retry('job-a', 'alice', 'book-a', { now: 100 });
    const again = jobs.retry('job-a', 'alice', 'book-a', { now: 101 });
    assert.notEqual(first.id, 'job-a');
    assert.equal(first.id, again.id);
    assert.equal(first.owner_id, 'alice');
    assert.equal(first.book_id, 'book-a');
    assert.equal(first.job_type, 'parse');
    assert.equal(first.status, 'retrying');
    assert.equal(first.current_stage, 'queued');
    assert.equal(first.idempotency_key, 'retry:job-a');
    for (const field of ['error_type', 'error_code', 'error_message', 'cancel_requested_at', 'lease_token', 'lease_expires_at']) {
      assert.equal(first[field], null, field);
    }
    assert.equal(db.prepare('SELECT status FROM book_jobs WHERE id=?').get('job-a').status, 'failed');
    assert.equal(db.prepare("SELECT count(*) n FROM book_jobs WHERE idempotency_key='retry:job-a'").get().n, 1);
    seed(db, { job: 'cancelled-job', status: 'cancelled' });
    assert.notEqual(jobs.retry('cancelled-job', 'alice', 'book-a').id, 'cancelled-job');
    seed(db, { job: 'running-job', status: 'running' });
    assert.equal(jobs.retry('running-job', 'alice', 'book-a'), null);
  } finally { db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('并发双 retry 只创建一个新任务', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-job-retry-race-'));
  const file = path.join(root, 'test.db');
  const db = new Database(file);
  const peer = new Database(file);
  try {
    initBookCore(db);
    seed(db, { status: 'failed' });
    const first = createBookJobService(db).retry('job-a', 'alice', 'book-a', { now: 100 });
    const second = createBookJobService(peer).retry('job-a', 'alice', 'book-a', { now: 100 });
    assert.equal(first.id, second.id);
    assert.equal(db.prepare("SELECT count(*) n FROM book_jobs WHERE idempotency_key='retry:job-a'").get().n, 1);
  } finally { peer.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('等待队列上限同时约束 enqueue 和 retry，旧任务保持终态', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-job-limit-'));
  const db = new Database(path.join(root, 'test.db'));
  try {
    initBookCore(db);
    const jobs = createBookJobService(db, { queueLimit: 2 });
    seed(db, { job: 'one', createdAt: 1 });
    seed(db, { job: 'two', createdAt: 2 });
    seed(db, { job: 'failed-job', status: 'failed', createdAt: 3 });
    assert.throws(() => jobs.enqueue({ id: 'three', bookId: 'book-a', ownerId: 'alice', jobType: 'parse', idempotencyKey: 'three' }),
      (error) => error.errorCode === 'RESOURCE_BUSY');
    assert.throws(() => jobs.retry('failed-job', 'alice', 'book-a'),
      (error) => error.errorCode === 'RESOURCE_BUSY');
    assert.equal(db.prepare("SELECT status FROM book_jobs WHERE id='failed-job'").get().status, 'failed');
    assert.equal(db.prepare("SELECT count(*) n FROM book_jobs WHERE idempotency_key='retry:failed-job'").get().n, 0);
    db.prepare("UPDATE book_jobs SET status='completed' WHERE id='one'").run();
    const retry = jobs.retry('failed-job', 'alice', 'book-a');
    seed(db, { job: 'extra', createdAt: 4 });
    assert.equal(jobs.retry('failed-job', 'alice', 'book-a').id, retry.id);
  } finally { db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('retry API 队列满返回 full 429 或 light 503 RESOURCE_BUSY', async () => {
  const f = await fixture({ queueLimit: 2 });
  try {
    seed(f.db, { job: 'one', createdAt: 1 });
    seed(f.db, { job: 'two', createdAt: 2 });
    seed(f.db, { job: 'failed-job', status: 'failed', createdAt: 3 });
    const response = await request(f, 'POST', '/api/books/book-a/jobs/failed-job/retry');
    assert.equal(response.status, process.env.BOOK_MVP_PROFILE === 'light' ? 503 : 429);
    assert.equal((await response.json()).errorCode, 'RESOURCE_BUSY');
    assert.equal(f.db.prepare("SELECT status FROM book_jobs WHERE id='failed-job'").get().status, 'failed');
  } finally { f.close(); }
});

test('retry 与 enqueue 使用同一事务容量检查，等待数不超过上限', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-job-mixed-race-'));
  const file = path.join(root, 'test.db');
  const db = new Database(file);
  const peer = new Database(file);
  try {
    initBookCore(db);
    seed(db, { job: 'waiting', createdAt: 1 });
    seed(db, { job: 'failed-job', status: 'failed', createdAt: 2 });
    createBookJobService(db, { queueLimit: 2 }).retry('failed-job', 'alice', 'book-a');
    assert.throws(() => createBookJobService(peer, { queueLimit: 2 }).enqueue({
      id: 'overflow', bookId: 'book-a', ownerId: 'alice', jobType: 'parse', idempotencyKey: 'overflow',
    }), (error) => error.errorCode === 'RESOURCE_BUSY');
    assert.equal(db.prepare("SELECT count(*) n FROM book_jobs WHERE status IN ('pending','retrying')").get().n, 2);
  } finally { peer.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('任务 API 跨用户统一 404，retry/cancel 校验 owner/book/job', async () => {
  const f = await fixture();
  try {
    seed(f.db, { status: 'failed' });
    for (const suffix of ['', '/retry', '/cancel']) {
      const method = suffix ? 'POST' : 'GET';
      const response = await request(f, method, `/api/books/book-a/jobs/job-a${suffix}`, 'bob');
      assert.equal(response.status, 404);
      assert.equal((await response.json()).errorCode, 'JOB_NOT_FOUND');
    }
    assert.equal((await request(f, 'POST', '/api/books/wrong/jobs/job-a/retry')).status, 404);
    const retried = await request(f, 'POST', '/api/books/book-a/jobs/job-a/retry');
    assert.equal(retried.status, 200);
    const retriedJob = (await retried.json()).job;
    assert.notEqual(retriedJob.id, 'job-a');
    assert.equal(f.db.prepare("SELECT status FROM book_jobs WHERE id='job-a'").get().status, 'failed');
    assert.equal((await request(f, 'POST', `/api/books/book-a/jobs/${retriedJob.id}/cancel`)).status, 200);
  } finally { f.close(); }
});

test('GET 动态聚合章节进度、队列位置和阶段，retrying 不计最终失败', async () => {
  const f = await fixture();
  try {
    seed(f.db, { job: 'ahead', createdAt: 1 });
    seed(f.db, { job: 'target', createdAt: 2 });
    const add = f.db.prepare(`INSERT INTO book_job_steps
      (id,job_id,chapter_id,step_type,status,input_hash,attempt_count) VALUES (?,?,?,?,?,?,?)`);
    add.run('s1', 'target', 'c1', 'extract', 'completed', '1', 1);
    add.run('s2', 'target', 'c2', 'extract', 'retrying', '2', 2);
    add.run('s3', 'target', 'c3', 'extract', 'running', '3', 1);
    f.db.prepare("UPDATE book_jobs SET current_stage='extracting' WHERE id='target'").run();
    const response = await request(f, 'GET', '/api/books/book-a/jobs/target');
    assert.equal(response.status, 200);
    const { job } = await response.json();
    assert.equal(job.totalChapters, 3);
    assert.equal(job.completedChapters, 1);
    assert.equal(job.failedChapters, 0);
    assert.equal(job.queuePosition, 2);
    assert.equal(job.currentStage, 'extracting');
  } finally { f.close(); }
});
