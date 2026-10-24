/**
 * 资料抽屉编辑版本历史：PUT 前快照 + 按用户查询。
 * 运行：node vocab-server/tests/knowledgeVaultRevisions.test.js
 */
const assert = require('assert');
const {
  buildKnowledgeVaultRevisionSnapshot,
  formatKnowledgeVaultRevision
} = require('../services/knowledgeVaultExtra');

const row = {
  id: 'k1',
  user_id: 'u1',
  type: 'english',
  word: 'hello',
  meaning: '你好',
  example: 'Hello world',
  title: '',
  category: '',
  summary: '',
  content: '',
  source: 'manual',
  added_at: 100,
  tags: JSON.stringify(['greet']),
  extra_json: JSON.stringify({ syncStatus: 'draft', moduleTargets: [] })
};

const snapshot = buildKnowledgeVaultRevisionSnapshot(row);
assert.equal(snapshot.id, 'k1');
assert.equal(snapshot.userId, 'u1');
assert.equal(snapshot.word, 'hello');
assert.equal(snapshot.meaning, '你好');
assert.equal(snapshot.syncStatus, 'draft');
assert.deepEqual(snapshot.tags, ['greet']);
assert.equal(snapshot.traces, undefined);

const formatted = formatKnowledgeVaultRevision({
  id: 'r1',
  knowledge_id: 'k1',
  user_id: 'u1',
  snapshot_json: JSON.stringify(snapshot),
  created_at: 42
});
assert.equal(formatted.id, 'r1');
assert.equal(formatted.knowledgeId, 'k1');
assert.equal(formatted.userId, 'u1');
assert.equal(formatted.createdAt, 42);
assert.equal(formatted.snapshot.word, 'hello');
assert.equal(formatted.snapshot.meaning, '你好');

console.log('knowledgeVaultRevisions.test.js passed');
