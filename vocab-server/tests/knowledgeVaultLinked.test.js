/**
 * Wave 1 车道 C 本地测试（纯函数，不打生产 HTTPS）。
 * 现有 knowledgeVaultCrud.test.js 才是打 https://app.liujingzhuwo.site 的请求测试。
 *
 * 运行：node vocab-server/tests/knowledgeVaultLinked.test.js
 *    或：node --test vocab-server/tests/knowledgeVaultLinked.test.js
 */
const assert = require('assert');
const {
  parseKnowledgeVaultExtra,
  buildKnowledgeVaultExtra,
  filterLinkedKnowledgeRows,
  sortLinkedKnowledgeRows,
  formatKnowledgeVaultRow,
  sanitizeModuleTargets
} = require('../services/knowledgeVaultExtra');

const extra = parseKnowledgeVaultExtra(null, 'manual');
assert.equal(extra.syncStatus, 'draft');
assert.deepEqual(extra.moduleTargets, []);
assert.equal(extra.sourceType, 'manual');

const oldRow = formatKnowledgeVaultRow({
  id: 'old',
  user_id: 'u1',
  type: 'theory',
  title: '信息不对称',
  summary: '一方掌握更多信息',
  source: 'manual',
  added_at: 100,
  extra_json: null,
  tags: null
});
assert.equal(oldRow.syncStatus, 'draft');
assert.equal(oldRow.addedAt, 100);
assert.deepEqual(oldRow.tags, []);

const synced = JSON.stringify({
  moduleTargets: ['listen', 'game_theory'],
  sourceType: 'manual',
  syncStatus: 'synced',
  confirmedAt: 300
});
const draft = JSON.stringify({
  moduleTargets: ['listen'],
  sourceType: 'manual',
  syncStatus: 'draft',
  confirmedAt: 400
});
const speakOnly = JSON.stringify({
  moduleTargets: ['speak'],
  sourceType: 'manual',
  syncStatus: 'synced',
  confirmedAt: 200
});

const rows = [
  { id: 'a', extra_json: synced, source: 'manual', added_at: 1 },
  { id: 'b', extra_json: draft, source: 'manual', added_at: 2 },
  { id: 'c', extra_json: speakOnly, source: 'manual', added_at: 3 }
];
assert.deepEqual(filterLinkedKnowledgeRows(rows, 'listen').map((r) => r.id), ['a']);
assert.deepEqual(filterLinkedKnowledgeRows(rows, 'speak').map((r) => r.id), ['c']);

const sorted = sortLinkedKnowledgeRows([
  { id: 'late', extra_json: JSON.stringify({ syncStatus: 'synced', moduleTargets: ['game_theory'], confirmedAt: 10 }), added_at: 1 },
  { id: 'early', extra_json: JSON.stringify({ syncStatus: 'synced', moduleTargets: ['game_theory'], confirmedAt: 90 }), added_at: 2 }
]);
assert.equal(sorted[0].id, 'early');

const approved = buildKnowledgeVaultExtra('{}', { moduleTargets: [], syncStatus: 'approved' }, 'manual');
assert.equal(approved.syncStatus, 'approved');
assert.deepEqual(sanitizeModuleTargets(['listen', 'nope', 'speak']), ['listen', 'speak']);
assert.deepEqual(sanitizeModuleTargets(['writing', 'aesthetic', 'nope']), ['writing', 'aesthetic']);

const traces = [];
traces.push({ id: 't1', knowledge_id: 'a', module: 'listen', action: 'analyzed', used_at: 1 });
traces.push({ id: 't2', knowledge_id: 'a', module: 'game_theory', action: 'analyzed', used_at: 2 });
assert.equal(traces.length, 2);
assert.equal(traces[0].id, 't1');
assert.equal(traces[1].id, 't2');

console.log('knowledgeVaultLinked.test.js passed');
