/**
 * Wave 5 知识图谱规划（纯函数，不依赖 better-sqlite3）。
 * 运行：node vocab-server/tests/knowledgeGraph.test.js
 */
const assert = require('assert');
const {
  knowledgeNodeId,
  moduleNodeId,
  planUserGraph
} = require('../services/knowledgeGraph');

const draft = {
  id: 'k-draft',
  user_id: 'u1',
  type: 'theory',
  title: '草稿知识',
  extra_json: JSON.stringify({ syncStatus: 'draft', moduleTargets: ['listen'] }),
  source: 'manual',
  added_at: 1
};
const synced = {
  id: 'k-sync',
  user_id: 'u1',
  type: 'theory',
  title: '信息不对称',
  extra_json: JSON.stringify({
    syncStatus: 'synced',
    moduleTargets: ['listen', 'speak', 'game_theory']
  }),
  source: 'manual',
  added_at: 2
};
const english = {
  id: 'k-en',
  user_id: 'u1',
  type: 'english',
  word: 'leverage',
  title: '',
  extra_json: JSON.stringify({ syncStatus: 'synced', moduleTargets: ['speak'] }),
  source: 'manual',
  added_at: 3
};

const plan = planUserGraph('u1', [draft, synced, english], [
  { knowledge_id: 'k-sync', module: 'listen' },
  { knowledge_id: 'k-sync', module: 'speak' },
  { knowledge_id: 'k-sync', module: 'game_theory' },
  { knowledge_id: 'k-draft', module: 'listen' }
]);

const knowledgeNodes = plan.nodes.filter((n) => n.kind === 'knowledge');
const moduleNodes = plan.nodes.filter((n) => n.kind === 'module');
assert.equal(moduleNodes.length, 5);
assert.equal(knowledgeNodes.length, 3);
assert.equal(knowledgeNodes.find((n) => n.refId === 'k-en').title, 'leverage');

const draftNodeId = knowledgeNodeId('k-draft');
const syncNodeId = knowledgeNodeId('k-sync');
const draftEdges = plan.edges.filter((e) => e.fromId === draftNodeId);
assert.equal(draftEdges.length, 0);

const syncSynced = plan.edges.filter((e) => e.fromId === syncNodeId && e.rel === 'synced_to');
const syncUsed = plan.edges.filter((e) => e.fromId === syncNodeId && e.rel === 'used_by');
assert.equal(syncSynced.length, 3);
assert.equal(syncUsed.length, 3);
assert.ok(syncSynced.some((e) => e.toId === moduleNodeId('u1', 'listen')));
assert.ok(syncSynced.some((e) => e.toId === moduleNodeId('u1', 'speak')));
assert.ok(syncSynced.some((e) => e.toId === moduleNodeId('u1', 'game_theory')));

const otherUser = planUserGraph('u2', [synced], []);
assert.ok(otherUser.nodes.every((n) => n.userId === 'u2'));
assert.ok(!otherUser.nodes.some((n) => n.id === moduleNodeId('u1', 'listen')));

console.log('knowledgeGraph.test.js passed');
