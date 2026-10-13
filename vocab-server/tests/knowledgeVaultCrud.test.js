const { test, before, after } = require('node:test');
const assert = require('node:assert');
const https = require('https');

const BASE = require('./helpers/testTarget').resolveTestApiBase();
if (!BASE) {
  test('知识库远程测试', { skip: '未设置独立测试服务 TEST_API_BASE_URL' }, () => {});
  return;
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const transport = BASE.startsWith('https:') ? https : require('node:http');
    const req = transport.request(new URL(path, BASE), options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = d ? JSON.parse(d) : null; } catch {}
        resolve({ status: res.statusCode, body: parsed, text: d });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const USER = `test-vault-${Date.now()}`;

test('POST /api/knowledge-vault/notes - create english note', async () => {
  const r = await req('POST', '/api/knowledge-vault/notes', {
    userId: USER,
    type: 'english',
    word: 'hello',
    meaning: '你好',
    example: 'Hello world',
    source: 'test'
  });
  assert.strictEqual(r.status, 201, 'POST status: ' + r.status + ' ' + r.text);
  assert.ok(r.body.id, 'body: ' + JSON.stringify(r.body));
});

test('GET /api/knowledge-vault/notes?userId=...&type=english - list', async () => {
  const r = await req('GET', `/api/knowledge-vault/notes?userId=${USER}&type=english`);
  assert.strictEqual(r.status, 200, 'GET status: ' + r.status + ' ' + r.text);
  assert.ok(Array.isArray(r.body), 'body: ' + JSON.stringify(r.body));
});

test('PUT /api/knowledge-vault/notes/:id - update', async () => {
  const created = await req('POST', '/api/knowledge-vault/notes', {
    userId: USER, type: 'english', word: 'update-me', meaning: 'old', example: '', source: 'test'
  });
  const r = await req('PUT', `/api/knowledge-vault/notes/${created.body.id}`, { userId: USER, meaning: 'new' });
  assert.strictEqual(r.status, 200, 'PUT status: ' + r.status + ' ' + r.text);
  assert.strictEqual(r.body.meaning, 'new', 'body: ' + JSON.stringify(r.body));
});

test('DELETE /api/knowledge-vault/notes/:id - delete', async () => {
  const created = await req('POST', '/api/knowledge-vault/notes', {
    userId: USER, type: 'english', word: 'delete-me', meaning: 'x', example: '', source: 'test'
  });
  const r = await req('DELETE', `/api/knowledge-vault/notes/${created.body.id}?userId=${encodeURIComponent(USER)}`);
  assert.strictEqual(r.status, 200, 'DELETE status: ' + r.status + ' ' + r.text);
});
