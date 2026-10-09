const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

function openDatabase(filePath) {
  const Database = require('better-sqlite3');
  return new Database(filePath);
}

const { createAuthService, createAuthRouter, requireAuth } = require('../services/authService');
const { initBookCore, createBookRouter, ALLOWED_BOOK_FORMATS, validateBookFile } = require('../services/bookService');

function palmMobi(encryptionType = 0) {
  const firstRecordOffset = 96;
  const bytes = Buffer.alloc(256);
  bytes.writeUInt16BE(1, 76); // PalmDB record count
  bytes.writeUInt32BE(firstRecordOffset, 78); // first record offset
  bytes.writeUInt16BE(encryptionType, firstRecordOffset + 12); // PalmDOC encryption type
  bytes.write('MOBI', firstRecordOffset + 16); // MOBI header
  return bytes;
}

const validFiles = {
  pdf: Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'),
  epub: Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(26), Buffer.from('mimetypeapplication/epub+zip')]),
  mobi: palmMobi(),
  azw3: palmMobi(),
  txt: Buffer.from('第一章\nReadable UTF-8 text'),
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-auth-slice-'));
  const db = openDatabase(path.join(root, 'test.db'));
  db.exec('CREATE TABLE invited_accounts (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)');
  initBookCore(db);
  const auth = createAuthService(db, { ttlMs: 60_000 });
  const aliceInvite = require('../scripts/invite-account').addAccount(db, 'alice');
  const bobInvite = require('../scripts/invite-account').addAccount(db, 'bob');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ auth, production: true }));
  app.use('/api/books', requireAuth(auth), createBookRouter({ db, storageRoot: path.join(root, 'private-books') }));
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    auth, db, root, server, invites: { alice: aliceInvite.inviteToken, bob: bobInvite.inviteToken },
    base: `http://127.0.0.1:${server.address().port}`,
    close() { server.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); },
  })));
}

async function login(f, userId) {
  const response = await fetch(`${f.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, inviteToken: f.invites[userId] }),
  });
  return { response, cookie: response.headers.get('set-cookie') };
}

async function upload(f, cookie, name, bytes) {
  const form = new FormData();
  form.append('file', new Blob([bytes]), name);
  return fetch(`${f.base}/api/books`, { method: 'POST', headers: { cookie }, body: form });
}

test('会话只持久化 token SHA-256，并支持到期与撤销', async () => {
  const f = await fixture();
  try {
    const issued = f.auth.login('alice', f.invites.alice, { now: 1000 });
    const row = f.db.prepare('SELECT token_hash FROM auth_sessions').get();
    assert.notEqual(row.token_hash, issued.token);
    assert.equal(row.token_hash, crypto.createHash('sha256').update(issued.token).digest('hex'));
    assert.equal(f.auth.authenticate(issued.token, { now: 1001 }).userId, 'alice');
    assert.equal(f.auth.authenticate(issued.token, { now: 61_001 }), null);
    const nextInvite = require('../scripts/invite-account').reissueAccount(f.db, 'alice').inviteToken;
    const active = f.auth.login('alice', nextInvite);
    assert.equal(f.auth.revoke(active.token), true);
    assert.equal(f.auth.authenticate(active.token), null);
  } finally { f.close(); }
});

test('登录 cookie 安全，session/logout 生命周期正确', async () => {
  const f = await fixture();
  try {
    const denied = await login(f, 'mallory');
    assert.equal(denied.response.status, 401);
    const { response, cookie } = await login(f, 'alice');
    assert.equal(response.status, 200);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Secure/i);
    const session = await fetch(`${f.base}/api/auth/session`, { headers: { cookie } });
    assert.deepEqual(await session.json(), { authenticated: true, userId: 'alice' });
    const logout = await fetch(`${f.base}/api/auth/logout`, { method: 'POST', headers: { cookie } });
    assert.equal(logout.status, 204);
    assert.equal((await fetch(`${f.base}/api/auth/session`, { headers: { cookie } })).status, 401);
  } finally { f.close(); }
});

test('书籍格式白名单包含且仅包含 MVP 格式', () => {
  assert.deepEqual([...ALLOWED_BOOK_FORMATS.keys()].sort(), ['azw3', 'epub', 'mobi', 'pdf', 'txt']);
});

test('五种格式通过最小签名校验，伪装、损坏及可靠 DRM 标记被拒绝', () => {
  for (const [extension, bytes] of Object.entries(validFiles)) {
    assert.equal(validateBookFile(extension, bytes).ok, true, extension);
  }
  assert.equal(validateBookFile('pdf', Buffer.from('not pdf')).ok, false);
  assert.equal(validateBookFile('epub', Buffer.from('PK\x03\x04broken')).ok, false);
  assert.equal(validateBookFile('mobi', Buffer.alloc(80)).ok, false);
  assert.equal(validateBookFile('txt', Buffer.from([0x61, 0, 0x62])).ok, false);
  assert.equal(validateBookFile('mobi', palmMobi(1)).ok, false);
  assert.equal(validateBookFile('azw3', palmMobi(2)).ok, false);
});

test('大 PDF 从文件尾读取 EOF 后通过校验', async () => {
  const f = await fixture();
  try {
    const alice = await login(f, 'alice');
    const largePdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(300 * 1024, 0x20), Buffer.from('\n%%EOF')]);
    assert.equal((await upload(f, alice.cookie, 'large.pdf', largePdf)).status, 201);
  } finally { f.close(); }
});

test('TXT 上传初筛接受 BOM UTF-16、GB18030 和 Windows-1252，拒绝明显二进制', () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('中文 text', 'utf16le')]);
  const gb18030 = Buffer.from([0xb5, 0xda, 0xd2, 0xbb, 0xd5, 0xc2, 0x0a, 0xce, 0xc4, 0xb1, 0xbe]);
  const windows1252 = Buffer.from([0x43, 0x61, 0x66, 0xe9]);
  assert.equal(validateBookFile('txt', utf16).ok, true);
  assert.equal(validateBookFile('txt', gb18030).ok, true);
  assert.equal(validateBookFile('txt', windows1252).ok, true);
  assert.equal(validateBookFile('txt', Buffer.from([0, 1, 2, 3, 0, 255])).ok, false);
});

test('未认证书籍接口返回 401', async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(`${f.base}/api/books`)).status, 401);
    assert.equal((await upload(f, '', 'notes.txt', validFiles.txt)).status, 401);
  } finally { f.close(); }
});

test('上传去重、用户隔离并持久化 pending job', async () => {
  const f = await fixture();
  try {
    const alice = await login(f, 'alice');
    const bob = await login(f, 'bob');
    const bad = await upload(f, alice.cookie, 'malware.exe', Buffer.from('MZ'));
    assert.equal(bad.status, 415);

    const first = await upload(f, alice.cookie, 'notes.txt', validFiles.txt);
    const firstBody = await first.json();
    assert.equal(first.status, 201, JSON.stringify(firstBody));
    const created = firstBody;
    assert.equal(created.jobStatus, 'pending');
    assert.ok(created.bookId && created.jobId && created.createdAt);

    const duplicate = await upload(f, alice.cookie, 'copy.txt', validFiles.txt);
    const duplicateBody = await duplicate.json();
    assert.equal(duplicate.status, 200);
    assert.deepEqual(duplicateBody, { ...created, deduplicated: true });
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM books WHERE owner_id = ?').get('alice').n, 1);
    assert.equal(f.db.prepare('SELECT status FROM book_jobs WHERE id = ?').get(created.jobId).status, 'pending');

    const bobUpload = await upload(f, bob.cookie, 'notes.txt', validFiles.txt);
    assert.equal(bobUpload.status, 201);
    assert.equal((await fetch(`${f.base}/api/books/${created.bookId}`, { headers: { cookie: bob.cookie } })).status, 404);
    assert.equal((await fetch(`${f.base}/api/books/${created.bookId}/jobs/${created.jobId}`, { headers: { cookie: bob.cookie } })).status, 404);
    assert.equal((await fetch(`${f.base}/api/books/${created.bookId}`, { headers: { cookie: alice.cookie } })).status, 200);
    assert.equal((await fetch(`${f.base}/api/books/${created.bookId}/jobs/${created.jobId}`, { headers: { cookie: alice.cookie } })).status, 200);
    const aliceList = await fetch(`${f.base}/api/books`, { headers: { cookie: alice.cookie } }).then((r) => r.json());
    const bobList = await fetch(`${f.base}/api/books`, { headers: { cookie: bob.cookie } }).then((r) => r.json());
    assert.equal(aliceList.books.length, 1);
    assert.equal(bobList.books.length, 1);
    assert.notEqual(aliceList.books[0].id, bobList.books[0].id);
  } finally { f.close(); }
});

test('并发同用户同 hash 由唯一约束裁决且保留胜者文件', async () => {
  const f = await fixture();
  try {
    const alice = await login(f, 'alice');
    const responses = await Promise.all([
      upload(f, alice.cookie, 'race-a.txt', Buffer.from('same concurrent content')),
      upload(f, alice.cookie, 'race-b.txt', Buffer.from('same concurrent content')),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    assert.equal(bodies[0].bookId, bodies[1].bookId);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM books').get().n, 1);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM book_revisions').get().n, 1);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM book_jobs').get().n, 1);
    const winner = f.db.prepare('SELECT file_path FROM book_revisions').get();
    assert.equal(fs.existsSync(winner.file_path), true);
  } finally { f.close(); }
});

test('落盘失败时清理 staged DB 记录和临时文件', async () => {
  const f = await fixture();
  const originalRename = fs.renameSync;
  try {
    const alice = await login(f, 'alice');
    fs.renameSync = () => { throw new Error('simulated rename failure'); };
    const response = await upload(f, alice.cookie, 'failure.txt', Buffer.from('different valid text'));
    assert.equal(response.status, 500);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM books').get().n, 0);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM book_revisions').get().n, 0);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM book_jobs').get().n, 0);
    assert.deepEqual(fs.readdirSync(path.join(f.root, 'private-books', 'temp')), []);
  } finally { fs.renameSync = originalRename; f.close(); }
});

test('server training session upsert 真实路径按用户和日期查询更新', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = server.indexOf("app.post('/api/training/session/upsert'");
  const end = server.indexOf("app.get('/api/training/session-by-date'", start);
  const route = server.slice(start, end);
  assert.match(route, /WHERE training_date = \? AND user_id = \?/);
  assert.match(route, /\.get\(trainingDate, userId\)/);
  assert.match(route, /WHERE id = \? AND user_id = \?/);
});

test('初始化可重复，并安全迁移 training_sessions 为用户日期唯一', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-migration-'));
  const db = openDatabase(path.join(root, 'test.db'));
  try {
    db.exec(`CREATE TABLE training_sessions (
      id TEXT PRIMARY KEY, user_id TEXT, training_date TEXT UNIQUE,
      total_minutes INTEGER DEFAULT 0, listen_minutes INTEGER DEFAULT 0,
      logic_minutes INTEGER DEFAULT 0, extra_json TEXT DEFAULT '{}', created_at INTEGER, updated_at INTEGER
    );`);
    db.prepare('INSERT INTO training_sessions (id, user_id, training_date) VALUES (?, ?, ?)').run('legacy', 'alice', '2026-09-05');
    initBookCore(db);
    initBookCore(db);
    assert.equal(db.prepare('SELECT id FROM training_sessions').get().id, 'legacy');
    assert.ok(db.prepare("SELECT 1 FROM book_migrations WHERE name='training_sessions_user_date_unique'").get());
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='training_sessions_legacy_book_auth'").get().n, 0);
    db.prepare('INSERT INTO training_sessions (id, user_id, training_date) VALUES (?, ?, ?)').run('bob-day', 'bob', '2026-09-05');
    assert.throws(() => db.prepare('INSERT INTO training_sessions (id, user_id, training_date) VALUES (?, ?, ?)').run('alice-duplicate', 'alice', '2026-09-05'));
    for (const table of ['books', 'book_revisions', 'book_source_units', 'book_jobs', 'book_job_steps']) {
      assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name=?").get(table).n, 1);
    }
    const revisionSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='book_revisions'").get().sql;
    assert.match(revisionSql, /UNIQUE\s*\(owner_id,\s*source_file_hash\)/i);
  } finally { db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('启动恢复 staged 记录并清理孤立临时文件', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-recovery-'));
  const db = openDatabase(path.join(root, 'test.db'));
  try {
    initBookCore(db);
    const storageRoot = path.join(root, 'private-books');
    fs.mkdirSync(path.join(storageRoot, 'temp'), { recursive: true });
    fs.writeFileSync(path.join(storageRoot, 'temp', 'orphan'), 'orphan');
    const now = Date.now();
    const sourceDir = path.join(storageRoot, 'source');
    fs.mkdirSync(sourceDir, { recursive: true });
    const stagedSource = path.join(sourceDir, 'staged-revision.txt');
    fs.writeFileSync(stagedSource, 'moved before crash');
    db.prepare('INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run('staged-book', 'alice', 'x', 'x.txt', 'staged', 'staged-revision', now, now);
    db.prepare('INSERT INTO book_revisions (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run('staged-revision', 'staged-book', 'alice', 'hash', stagedSource, 18, 'txt', 'staged', now);
    db.prepare('INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,created_at) VALUES (?,?,?,?,?,?)')
      .run('staged-job', 'staged-book', 'alice', 'parse', 'staged', now);
    createBookRouter({ db, storageRoot });
    assert.equal(db.prepare("SELECT count(*) AS n FROM books WHERE status='staged'").get().n, 0);
    assert.equal(fs.existsSync(stagedSource), false);
    assert.deepEqual(fs.readdirSync(path.join(storageRoot, 'temp')), []);
  } finally { db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
