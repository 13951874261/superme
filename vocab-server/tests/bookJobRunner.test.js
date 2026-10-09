const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { initBookCore } = require('../services/bookService');
const { createBookJobService } = require('../services/bookJobService');
const { createBookJobRunner } = require('../services/bookJobRunner');
const { createBookChapterService } = require('../services/bookChapterService');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-runner-'));
  const db = new Database(path.join(root, 'test.db'));
  initBookCore(db);
  const now = Date.now();
  db.prepare(`INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at)
    VALUES ('book','alice','A','a.txt','pending','revision',?,?)`).run(now, now);
  db.prepare(`INSERT INTO book_revisions
    (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,detected_format,status,created_at)
    VALUES ('revision','book','alice','hash',?,1,'txt','txt','pending',?)`).run(path.join(root, 'a.txt'), now);
  fs.writeFileSync(path.join(root, 'a.txt'), '第一章 开始\nhello');
  db.prepare(`INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at)
    VALUES ('job','book','alice','parse','pending','queued','hash',?)`).run(now);
  return { root, db, jobs: createBookJobService(db, options), close() { db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

async function waitUntil(predicate, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('runner 完成 source 后生成章节候选并停在等待确认', async () => {
  const f = fixture({ leaseMs: 5000 }); let calls = 0;
  try {
    const chapters = createBookChapterService(f.db);
    const runner = createBookJobRunner({ db: f.db, jobService: f.jobs, chapterService: chapters, pollMs: 5, heartbeatMs: 5,
      extractor: { extract: async () => {
        calls++; await new Promise((resolve) => setTimeout(resolve, 20));
        const file = path.join(f.root, 'unit.txt'); fs.writeFileSync(file, '第一章 开始\nhello');
        f.db.prepare(`INSERT INTO book_source_units
          (id,book_revision_id,unit_type,unit_index,raw_text_path,corrected_text_path,locator_json,status)
          VALUES ('unit','revision','segment',0,?,?,?,'completed')`).run(file, file, JSON.stringify({ kind: 'text', startLine: 1, endLine: 2, startChar: 0, endChar: 11 }));
      } } });
    await runner.runOnce();
    const row = f.db.prepare("SELECT * FROM book_jobs WHERE id='job'").get();
    assert.equal(calls, 1); assert.equal(row.status, 'completed'); assert.equal(row.current_stage, 'awaiting_chapter_confirmation');
    assert.equal(f.db.prepare('SELECT count(*) n FROM book_chapters').get().n, 1);
    assert.equal(f.db.prepare("SELECT status FROM books WHERE id='book'").get().status, 'awaiting_chapter_confirmation');
    assert.ok(row.heartbeat_at); assert.ok(row.finished_at);
  } finally { f.close(); }
});

test('parse runner 不领取更早的非 parse job', async () => {
  const f = fixture(); let calls = 0;
  try {
    f.db.prepare("UPDATE book_jobs SET job_type='framework',created_at=1 WHERE id='job'").run();
    f.db.prepare(`INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at)
      VALUES ('parse-job','book','alice','parse','pending','queued','parse-hash',2)`).run();
    const runner = createBookJobRunner({ db: f.db, jobService: f.jobs, chapterService: { generateCandidates() {} }, extractor: { extract: async () => { calls++; } } });
    await runner.runOnce();
    assert.equal(calls, 1);
    assert.equal(f.db.prepare("SELECT status FROM book_jobs WHERE id='job'").get().status, 'pending');
    assert.equal(f.db.prepare("SELECT status FROM book_jobs WHERE id='parse-job'").get().status, 'completed');
  } finally { f.close(); }
});

test('配置错误直接 failed；临时错误退避且达到 attempt 上限', async () => {
  const f = fixture();
  try {
    let now = 100;
    const configRunner = createBookJobRunner({ db: f.db, jobService: f.jobs, now: () => now,
      extractor: { extract: async () => { const error = new Error('bad config'); error.errorCode = 'PDF_RENDER_ADAPTER_UNAVAILABLE'; throw error; } } });
    await configRunner.runOnce();
    let row = f.db.prepare("SELECT * FROM book_jobs WHERE id='job'").get();
    assert.equal(row.status, 'failed'); assert.equal(row.error_code, 'PDF_RENDER_ADAPTER_UNAVAILABLE');

    f.db.prepare("UPDATE book_jobs SET status='pending',attempt_count=0,next_attempt_at=NULL,finished_at=NULL WHERE id='job'").run();
    const retryRunner = createBookJobRunner({ db: f.db, jobService: f.jobs, now: () => now, maxAttempts: 2, baseBackoffMs: 50,
      extractor: { extract: async () => { const error = new Error('offline'); error.errorCode = 'OCR_UNAVAILABLE'; error.retryable = true; throw error; } } });
    await retryRunner.runOnce();
    row = f.db.prepare("SELECT * FROM book_jobs WHERE id='job'").get();
    assert.equal(row.status, 'retrying'); assert.equal(row.attempt_count, 1); assert.equal(row.next_attempt_at, 150);
    assert.equal(await retryRunner.runOnce(), false, '退避期间禁止热循环');
    now = 150; await retryRunner.runOnce();
    row = f.db.prepare("SELECT * FROM book_jobs WHERE id='job'").get();
    assert.equal(row.status, 'failed'); assert.equal(row.attempt_count, 2);
  } finally { f.close(); }
});

test('light profile 的 RESOURCE_BUSY 不排队重试', async () => {
  const f = fixture();
  try {
    const runner = createBookJobRunner({ db: f.db, jobService: f.jobs, profile: 'light',
      extractor: { extract: async () => { const error = new Error('服务器繁忙，请稍后重试'); error.errorCode = 'RESOURCE_BUSY'; error.retryable = true; throw error; } } });
    await runner.runOnce();
    const row = f.db.prepare("SELECT * FROM book_jobs WHERE id='job'").get();
    assert.equal(row.status, 'failed'); assert.equal(row.error_code, 'RESOURCE_BUSY'); assert.equal(row.next_attempt_at, null);
  } finally { f.close(); }
});

test('取消贯穿 extractor，停止后续工作且 runner 不覆盖 cancelled', async () => {
  const f = fixture(); let observedSignal;
  try {
    const runner = createBookJobRunner({ db: f.db, jobService: f.jobs,
      extractor: { extract: async ({ signal }) => { observedSignal = signal; f.jobs.requestCancel('job', 'alice', 'book'); await new Promise((resolve) => setImmediate(resolve)); signal.throwIfAborted(); } } });
    await runner.runOnce();
    assert.equal(observedSignal.aborted, true);
    assert.equal(f.db.prepare("SELECT status FROM book_jobs WHERE id='job'").get().status, 'cancelled');
  } finally { f.close(); }
});
