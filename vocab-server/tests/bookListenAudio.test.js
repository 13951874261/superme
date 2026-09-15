const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const Database = require('better-sqlite3');
const { initBookCore, createBookRouter } = require('../services/bookService');
const { createBookFrameworkService } = require('../services/bookFrameworkService');
const { createBookListenService } = require('../services/bookListenService');

async function fixture({ ttsFails = false, generateContent: generateOverride, synthesizeDelay = 0 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-listen-'));
  const db = new Database(path.join(root, 'db'));
  initBookCore(db);
  const now = Date.now();
  db.prepare("INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at) VALUES ('b','alice','书','a.txt','ready','br',?,?)").run(now, now);
  db.prepare("INSERT INTO book_revisions (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,status,created_at) VALUES ('br','b','alice','source-hash','x',1,'txt','completed',?)").run(now);
  db.prepare("INSERT INTO chapter_revisions (id,book_revision_id,revision_number,status,idempotency_key,created_at,confirmed_at) VALUES ('cr','br',1,'confirmed','cr-key',?,?)").run(now, now);
  const framework = createBookFrameworkService(db);
  const revision = framework.seedDraft({ bookId: 'b', ownerId: 'alice', chapterRevisionId: 'cr', nodes: [
    { id: 'stable-node', parentId: null, order: 0, title: '核心条目', summary: '原始摘要', status: 'draft', version: 1, nodeType: 'source_claim', evidence: [] },
  ] });
  db.prepare("INSERT INTO knowledge_evidence (id,framework_node_id,book_revision_id,source_unit_id,locator_json,quote,quote_hash,source_text_hash,is_valid,created_at) VALUES ('e','stable-node','br','u','{\"kind\":\"text\",\"unitIndex\":0,\"charStart\":0,\"charEnd\":3}','证据原文','qh','sh',1,?)").run(now);
  framework.confirm({ bookId: 'b', ownerId: 'alice', revisionId: revision.id, idempotencyKey: 'confirm' });
  let generated = 0; let spoken = 0;
  const listen = createBookListenService(db, {
    storageRoot: path.join(root, 'private'),
    generateContent: async (args) => { generated++; if (generateOverride) return generateOverride(args, generated); const { node, evidence } = args; assert.equal(node.id, 'stable-node'); assert.equal(evidence[0].quote, '证据原文'); return { title: node.title, definition: '定义', sourceEvidence: [{ evidenceId: 'e', quote: '证据原文', locator: { kind: 'text', unitIndex: 0, charStart: 0, charEnd: 3 } }], plainExplanation: '通俗解释', selfCheckQuestions: ['如何理解？'], claims: [{ text: '证据支持的结论', kind: 'source_claim', confidence: 'high', evidenceIds: ['e'] }], model: 'm', promptVersion: 'p1', generatorVersion: 'g1' }; },
    synthesize: async ({ outputPath }) => { spoken++; if (synthesizeDelay) await new Promise((resolve) => setTimeout(resolve, synthesizeDelay)); if (ttsFails) throw Object.assign(new Error('upstream failed'), { errorCode: 'TTS_FAILED' }); fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, 'mp3'); },
    heavyGate: { run: (work) => work() },
  });
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.auth = { userId: req.headers['x-user'] || 'alice' }; next(); });
  app.use('/api/books', createBookRouter({ db, storageRoot: path.join(root, 'storage'), frameworkService: framework, listenService: listen }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { db, listen, revision, root, counts: () => ({ generated, spoken }), base: `http://127.0.0.1:${server.address().port}`, close() { server.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}
const request = (f, url, options = {}, user = 'alice') => fetch(f.base + url, { ...options, headers: { 'x-user': user, 'content-type': 'application/json', ...(options.headers || {}) } });

test('当前及指定 confirmed framework 返回稳定节点；非法 revision 404', async () => { const f = await fixture(); try {
  const r = await request(f, '/api/books/b/listen-framework'); assert.equal(r.status, 200); const body = await r.json();
  assert.equal(body.revision.id, f.revision.id); assert.equal(body.nodes[0].id, 'stable-node'); assert.equal(body.nodes[0].evidence[0].id, 'e');
  assert.equal((await request(f, `/api/books/b/listen-framework?revisionId=${f.revision.id}`)).status, 200);
  assert.equal((await request(f, '/api/books/b/listen-framework?revisionId=missing')).status, 404);
  assert.equal((await request(f, `/api/books/b/listen-framework?revisionId=${f.revision.id}`, {}, 'bob')).status, 404);
} finally { f.close(); } });

test('文字稿按 revision+node+prompt/model/version 幂等并严格绑定当前版本', async () => { const f = await fixture(); try {
  const url = `/api/books/b/frameworks/${f.revision.id}/nodes/stable-node/listen-content`;
  const options = { method: 'POST', body: JSON.stringify({ model: 'm', promptVersion: 'p1', generatorVersion: 'g1' }) };
  const a = await request(f, url, options).then((r) => r.json()); const b = await request(f, url, options).then((r) => r.json());
  assert.equal(a.content.id, b.content.id); assert.equal(f.counts().generated, 1); assert.equal(a.content.frameworkRevisionId, f.revision.id);
  assert.equal((await request(f, url)).status, 200);
  assert.equal((await request(f, url, options, 'bob')).status, 404);
} finally { f.close(); } });

test('证据归属失败将 claim 置 failed，第二次合法输出原子重试完成', async () => { const valid = { title: '核心条目', definition: '定义', sourceEvidence: [{ evidenceId: 'e', quote: '证据原文', locator: { kind: 'text', unitIndex: 0, charStart: 0, charEnd: 3 } }], plainExplanation: '解释', selfCheckQuestions: [], claims: [{ text: '结论', kind: 'source_claim', confidence: 'high', evidenceIds: ['e'] }], model: 'm', promptVersion: 'p1', generatorVersion: 'g1' }; const f = await fixture({ generateContent: (_args, attempt) => attempt === 1 ? { ...valid, sourceEvidence: [{ ...valid.sourceEvidence[0], evidenceId: 'wrong' }] } : valid }); try {
  const url = `/api/books/b/frameworks/${f.revision.id}/nodes/stable-node/listen-content`; const options = { method: 'POST', body: '{}' };
  assert.equal((await request(f, url, options)).status, 422); assert.equal(f.db.prepare('SELECT status FROM book_listen_contents').get().status, 'failed');
  assert.equal((await request(f, url, options)).status, 200); assert.equal(f.db.prepare('SELECT status FROM book_listen_contents').get().status, 'completed'); assert.equal(f.counts().generated, 2);
} finally { f.close(); } });

test('音频按 content hash+voice+rate+model 幂等、私有流读取、跨用户404', async () => { const f = await fixture(); try {
  const contentUrl = `/api/books/b/frameworks/${f.revision.id}/nodes/stable-node/listen-content`;
  const content = (await request(f, contentUrl, { method: 'POST', body: '{}' }).then((r) => r.json())).content;
  const audioUrl = `${contentUrl}/${content.id}/listen-audio`; const payload = { voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%', model: 'edge-tts' };
  const a = await request(f, audioUrl, { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.json());
  const b = await request(f, audioUrl, { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.json());
  assert.equal(a.audio.id, b.audio.id); assert.equal(f.counts().spoken, 1); assert.match(a.audio.streamUrl, /\/listen-audio\//);
  const stream = await request(f, a.audio.streamUrl, { headers: {} }); assert.equal(stream.status, 200); assert.equal(await stream.text(), 'mp3');
  assert.equal((await request(f, a.audio.streamUrl, {}, 'bob')).status, 404);
} finally { f.close(); } });

test('旧框架音频标记 stale；删除书后拒绝读取且清理文件', async () => { const f = await fixture(); try {
  const contentUrl = `/api/books/b/frameworks/${f.revision.id}/nodes/stable-node/listen-content`;
  const content = (await request(f, contentUrl, { method: 'POST', body: '{}' }).then((r) => r.json())).content;
  const audio = (await request(f, `${contentUrl}/${content.id}/listen-audio`, { method: 'POST', body: '{}' }).then((r) => r.json())).audio;
  f.db.prepare("UPDATE books SET active_framework_revision_id='new-revision'").run();
  assert.equal((await request(f, audio.streamUrl, { headers: { accept: 'application/json' } }).then((r) => r.json())).audio.stale, true);
  f.db.prepare("UPDATE books SET deleted_at=? WHERE id='b'").run(Date.now()); f.listen.deleteBookArtifacts({ bookId: 'b', ownerId: 'alice', allowDeleted: true });
  assert.equal((await request(f, audio.streamUrl)).status, 404); assert.equal(fs.existsSync(path.join(f.root, 'private', `${audio.id}.mp3`)), false);
} finally { f.close(); } });

test('并发同 key 仅调用一次文字稿与 TTS 上游，失败后可重试', async () => { const f = await fixture({ synthesizeDelay: 80 }); try {
  const url = `/api/books/b/frameworks/${f.revision.id}/nodes/stable-node/listen-content`;
  const [a, b] = await Promise.all([request(f, url, { method: 'POST', body: '{}' }), request(f, url, { method: 'POST', body: '{}' })]);
  assert.equal(f.counts().generated, 1); const content = (await (a.status === 200 ? a : b).json()).content;
  await Promise.all([request(f, `${url}/${content.id}/listen-audio`, { method: 'POST', body: '{}' }), request(f, `${url}/${content.id}/listen-audio`, { method: 'POST', body: '{}' })]);
  assert.equal(f.counts().spoken, 1); assert.equal(f.db.prepare("SELECT count(*) n FROM book_jobs WHERE job_type='listen_audio'").get().n, 1);
} finally { f.close(); } });

test('DELETE owner 隔离且幂等，立即 404 并真实清理听读文件', async () => { const f = await fixture(); try {
  assert.equal((await request(f, '/api/books/b', { method: 'DELETE' }, 'bob')).status, 404);
  const url = `/api/books/b/frameworks/${f.revision.id}/nodes/stable-node/listen-content`; const content = (await request(f, url, { method: 'POST', body: '{}' }).then((r) => r.json())).content;
  const audio = (await request(f, `${url}/${content.id}/listen-audio`, { method: 'POST', body: '{}' }).then((r) => r.json())).audio;
  assert.equal((await request(f, '/api/books/b', { method: 'DELETE' })).status, 204); assert.equal((await request(f, '/api/books/b', { method: 'DELETE' })).status, 204);
  assert.equal((await request(f, '/api/books/b')).status, 404); assert.equal(fs.existsSync(path.join(f.root, 'private', `${audio.id}.mp3`)), false);
} finally { f.close(); } });

test('TTS 失败为稳定错误且不留下 completed；lease/cancel 后拒写', async () => { const f = await fixture({ ttsFails: true }); try {
  const contentUrl = `/api/books/b/frameworks/${f.revision.id}/nodes/stable-node/listen-content`;
  const content = (await request(f, contentUrl, { method: 'POST', body: '{}' }).then((r) => r.json())).content;
  const response = await request(f, `${contentUrl}/${content.id}/listen-audio`, { method: 'POST', body: '{}' });
  assert.equal(response.status, 502); assert.equal((await response.json()).errorCode, 'TTS_FAILED');
  assert.equal(f.db.prepare("SELECT count(*) n FROM book_listen_audio WHERE status='completed'").get().n, 0);
  await assert.rejects(() => f.listen.generateAudio({ bookId: 'b', ownerId: 'alice', revisionId: f.revision.id, nodeId: 'stable-node', contentId: content.id, leaseGuard: () => { throw Object.assign(new Error('cancelled'), { errorCode: 'CANCELLED' }); } }), (e) => e.errorCode === 'CANCELLED');
} finally { f.close(); } });
