const https = require('https');
const assert = require('assert');

const BASE = 'https://app.liujingzhuwo.site';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(BASE + path, {
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, res => {
      let text = '';
      res.on('data', c => text += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, body: parsed, text });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const userId = 'test-prototype-crud-' + Date.now();
  const name = '测试财务总监A';
  console.log('User:', userId);

  // Create
  const create = await request('POST', '/api/game-theory/prototypes', {
    userId, name, type: '利益驱动型', description: '极度关注个人利益和短期业绩，谈判时容易被数据和资源交换影响。'
  });
  console.log('CREATE', create.status, JSON.stringify(create.body));
  assert.strictEqual(create.status, 200);
  assert.strictEqual(create.body.success, true);
  assert.ok(create.body.id);

  const id = create.body.id;

  // Read
  const list1 = await request('GET', '/api/game-theory/prototypes?userId=' + encodeURIComponent(userId));
  console.log('LIST', list1.status, JSON.stringify(list1.body));
  assert.strictEqual(list1.status, 200);
  assert.ok(Array.isArray(list1.body));
  assert.ok(list1.body.some(p => p.id === id && p.name === name));

  // Update same name
  const update = await request('POST', '/api/game-theory/prototypes', {
    userId, name, type: '面子驱动型', description: '更新后的描述'
  });
  console.log('UPDATE', update.status, JSON.stringify(update.body));
  assert.strictEqual(update.status, 200);
  assert.strictEqual(update.body.status, 'updated');
  assert.strictEqual(update.body.id, id);

  // Delete
  const del = await request('DELETE', '/api/game-theory/prototypes/' + encodeURIComponent(id));
  console.log('DELETE', del.status, JSON.stringify(del.body));
  assert.strictEqual(del.status, 200);
  assert.strictEqual(del.body.success, true);

  // Confirm deletion
  const list2 = await request('GET', '/api/game-theory/prototypes?userId=' + encodeURIComponent(userId));
  assert.strictEqual(list2.status, 200);
  assert.ok(!list2.body.some(p => p.id === id));

  console.log('PASS personal prototypes CRUD');
})().catch(e => { console.error('FAIL', e); process.exit(1); });