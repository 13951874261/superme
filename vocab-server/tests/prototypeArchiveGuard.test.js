const assert = require('assert');
const {
  normalizePrototypeArchive,
  isTestFixturePrototypeName,
  filterVisiblePrototypes,
} = require('../services/prototypeArchiveGuard');

const rejectedWithoutTrustedContext = [
  { name: '财务总监A', type: '利益驱动型', description: '关注短期业绩和资源交换' },
  { name: '空降VP', type: '面子驱动型', description: '偏好公开施压' },
  { name: '用户本人', type: '谨慎型', description: '这是对用户本人的性格描述' },
  { name: '我的性格', type: '利益驱动型', description: '自我画像' },
  { name: '我', type: '恐惧驱动型', description: '用户自我描述' },
  { name: '', type: '利益驱动型', description: 'empty name' },
  { name: 'E2E-VP-122046', type: '测试型', description: '夹具对手' },
  null,
];

for (const input of rejectedWithoutTrustedContext) {
  assert.strictEqual(normalizePrototypeArchive(input), null, 'expected rejected: ' + JSON.stringify(input));
}

assert.equal(isTestFixturePrototypeName('E2E-VP-122046'), true);
assert.equal(isTestFixturePrototypeName('E2E_BOT_01'), true);
assert.equal(isTestFixturePrototypeName('财务总监A'), false);
assert.equal(isTestFixturePrototypeName('空降VP'), false);

const visible = filterVisiblePrototypes([
  { id: '1', name: '财务总监A' },
  { id: '2', name: 'E2E-VP-122046' },
  { id: '3', name: 'E2E-VP-127472' },
  { id: '4', name: '空降VP' },
]);
assert.deepEqual(visible.map((row) => row.id), ['1', '4']);

const opponentContext = {
  opponentName: '大区VP',
  opponentRoleId: 'opponent',
  opponentEvidenceText: '大区VP在会上说：延期主要是区域执行不到位。',
};
assert.deepEqual(
  normalizePrototypeArchive({
    subject: 'opponent',
    subject_role_id: 'opponent',
    name: '大区VP',
    type: '责任转移型',
    description: '通过公开定性转移责任',
    evidence: [{ actor_role_id: 'opponent', quote: '延期主要是区域执行不到位' }],
  }, opponentContext),
  {
    name: '大区VP',
    type: '责任转移型',
    description: '通过公开定性转移责任',
  }
);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'user',
  subject_role_id: 'user',
  name: '谨慎谈判者',
  type: '防御型',
  description: '根据用户表现归档',
  evidence: [{ actor_role_id: 'user', quote: '我建议先核对排期' }],
}, opponentContext), null);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'opponent',
  subject_role_id: 'user',
  name: '大区VP',
  type: '责任转移型',
  description: '角色标识错位',
  evidence: [{ actor_role_id: 'user', quote: '我建议先核对排期' }],
}, opponentContext), null);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'opponent',
  subject_role_id: 'opponent',
  name: '大区VP',
  type: '责任转移型',
  description: '证据来自用户',
  evidence: [{ actor_role_id: 'user', quote: '我建议先核对排期' }],
}, opponentContext), null);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'opponent',
  subject_role_id: 'opponent',
  name: '财务总监',
  type: '责任转移型',
  description: '主体名称不一致',
  evidence: [{ actor_role_id: 'opponent', quote: '延期主要是区域执行不到位' }],
}, opponentContext), null);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'opponent',
  subject_role_id: 'opponent',
  name: '大区VP',
  type: '责任转移型',
  description: '伪造对手证据',
  evidence: [{ actor_role_id: 'opponent', quote: '我建议先核对排期' }],
}, opponentContext), null);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'opponent',
  subject_role_id: 'opponent',
  name: '大区VP',
  type: '责任转移型',
  description: '缺少证据原话',
  evidence: [{ actor_role_id: 'opponent', quote: '' }],
}, opponentContext), null);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'opponent',
  subject_role_id: 'opponent',
  name: '大区VP',
  type: '责任转移型',
  description: '无意义短证据',
  evidence: [{ actor_role_id: 'opponent', quote: '延期' }],
}, opponentContext), null);
assert.strictEqual(normalizePrototypeArchive({
  subject: 'opponent',
  subject_role_id: 'opponent',
  name: '大区VP',
  type: '责任转移型',
  description: '空上下文',
  evidence: [{ actor_role_id: 'opponent', quote: '延期主要是区域执行不到位' }],
}, { opponentName: '', opponentRoleId: '', opponentEvidenceText: '' }), null);

console.log('OK prototypeArchiveGuard');