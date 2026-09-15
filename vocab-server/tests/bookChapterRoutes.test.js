const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const Database = require('better-sqlite3');
const { createAuthService, createAuthRouter, requireAuth } = require('../services/authService');
const { initBookCore, createBookRouter } = require('../services/bookService');
const { createBookChapterService } = require('../services/bookChapterService');

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-chapter-routes-'));
  const db = new Database(path.join(root, 'test.db')); initBookCore(db);
  db.exec('CREATE TABLE invited_accounts (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)');
  const now = Date.now();
  db.prepare(`INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at)
    VALUES ('book','alice','A','a.txt','awaiting_chapter_confirmation','revision',?,?)`).run(now, now);
  db.prepare(`INSERT INTO book_revisions (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,detected_format,status,created_at)
    VALUES ('revision','book','alice','hash','a.txt',1,'txt','txt','awaiting_chapter_confirmation',?)`).run(now);
  const file = path.join(root, 'source.txt'); fs.writeFileSync(file, '第一章\n正文');
  db.prepare(`INSERT INTO book_source_units (id,book_revision_id,unit_type,unit_index,raw_text_path,corrected_text_path,locator_json,status)
    VALUES ('unit','revision','segment',0,?,?,?,'completed')`).run(file, file, JSON.stringify({ kind: 'text', startLine: 1, endLine: 2, startChar: 0, endChar: 7 }));
  db.prepare(`INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at)
    VALUES ('job','book','alice','parse','completed','awaiting_chapter_confirmation','hash',?)`).run(now);
  const chapters = createBookChapterService(db); chapters.generateCandidates({ bookRevisionId: 'revision' });
  const auth = createAuthService(db);
  const invite = require('../scripts/invite-account');
  const invites = { alice: invite.addAccount(db, 'alice').inviteToken, bob: invite.addAccount(db, 'bob').inviteToken };
  const app = express(); app.use(express.json());
  app.use('/api/auth', createAuthRouter({ auth, production: true }));
  app.use('/api/books', requireAuth(auth), createBookRouter({ db, storageRoot: path.join(root, 'storage'), chapterService: chapters }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { db, server, root, invites, base: `http://127.0.0.1:${server.address().port}`, close() { server.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

async function login(f, userId) {
  const response = await fetch(`${f.base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, inviteToken: f.invites[userId] }) });
  return response.headers.get('set-cookie');
}

test('GET/PATCH/confirm 章节 API 支持草稿编辑和幂等确认', async () => {
  const f = await fixture();
  try {
    const cookie = await login(f, 'alice');
    let response = await fetch(`${f.base}/api/books/book/chapters`, { headers: { cookie } });
    assert.equal(response.status, 200); const listed = await response.json(); assert.equal(listed.chapters.length, 1);
    response = await fetch(`${f.base}/api/books/book/chapters/${listed.chapters[0].id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: '新标题', level: 2 }),
    });
    assert.equal(response.status, 200); assert.equal((await response.json()).chapter.title, '新标题');
    response = await fetch(`${f.base}/api/books/book/chapters/confirm`, { method: 'POST', headers: { cookie, 'idempotency-key': 'same' } });
    assert.equal(response.status, 200); const first = await response.json();
    response = await fetch(`${f.base}/api/books/book/chapters/confirm`, { method: 'POST', headers: { cookie, 'idempotency-key': 'same' } });
    assert.equal((await response.json()).chapterRevision.id, first.chapterRevision.id);
    assert.equal((await fetch(`${f.base}/api/books/book/chapters/${listed.chapters[0].id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: '禁止' }),
    })).status, 409);
  } finally { f.close(); }
});

test('API 幂等克隆 confirmed revision 为新 draft 并独立确认', async () => {
  const f = await fixture();
  try {
    const cookie = await login(f, 'alice');
    const confirmed = await fetch(`${f.base}/api/books/book/chapters/confirm`, { method: 'POST', headers: { cookie, 'idempotency-key': 'first' } }).then((r) => r.json());
    const url = `${f.base}/api/books/book/chapters/revisions/${confirmed.chapterRevision.id}/draft`;
    const first = await fetch(url, { method: 'POST', headers: { cookie, 'idempotency-key': 'clone' } });
    const second = await fetch(url, { method: 'POST', headers: { cookie, 'idempotency-key': 'clone' } });
    assert.equal(first.status, 200); const draft = (await first.json()).chapterRevision; assert.equal(draft.id, (await second.json()).chapterRevision.id);
    const confirmedDraft = await fetch(`${f.base}/api/books/book/chapters/confirm`, { method: 'POST', headers: { cookie, 'idempotency-key': 'second', 'content-type': 'application/json' }, body: JSON.stringify({ draftRevisionId: draft.id }) });
    assert.equal(confirmedDraft.status, 200); assert.equal((await confirmedDraft.json()).chapterRevision.id, draft.id);
  } finally { f.close(); }
});

test('章节资源对非 owner 统一返回 404', async () => {
  const f = await fixture();
  try {
    const cookie = await login(f, 'bob');
    assert.equal((await fetch(`${f.base}/api/books/book/chapters`, { headers: { cookie } })).status, 404);
    assert.equal((await fetch(`${f.base}/api/books/book/chapters/missing`, { method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: '{}' })).status, 404);
    assert.equal((await fetch(`${f.base}/api/books/book/chapters/confirm`, { method: 'POST', headers: { cookie, 'idempotency-key': 'x' } })).status, 404);
  } finally { f.close(); }
});

test('PATCH 拒绝越界 locator，confirm 要求 Idempotency-Key', async () => {
  const f = await fixture();
  try {
    const cookie = await login(f, 'alice'); const listed = await fetch(`${f.base}/api/books/book/chapters`, { headers: { cookie } }).then((r) => r.json());
    const invalid = await fetch(`${f.base}/api/books/book/chapters/${listed.chapters[0].id}`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ endLocator: { kind: 'text', unitIndex: 0, line: 99, char: 99 } }),
    });
    assert.equal(invalid.status, 422);
    assert.equal((await fetch(`${f.base}/api/books/book/chapters/confirm`, { method: 'POST', headers: { cookie } })).status, 400);
  } finally { f.close(); }
});
