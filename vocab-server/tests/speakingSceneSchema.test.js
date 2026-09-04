const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateSpeakingScene,
} = require('../services/personalizedSpeakingSceneService');

const multiRole = {
  title: 'Quarterly roadmap negotiation',
  background: 'A product team must cut one planned initiative.',
  roles: [
    { name: 'Product lead', identity: 'Owns the roadmap', stance: 'Protect retention work', roleType: 'ally' },
    { name: 'Sales lead', identity: 'Owns enterprise revenue', stance: 'Protect a promised integration', roleType: 'blocker' },
  ],
  conflict: 'Only one initiative can remain.',
  objective: 'Reach a defensible agreement.',
  tasks: ['State priorities', 'Challenge one assumption'],
  opening: 'Thanks for joining. We need one decision today.',
};

const impromptu = {
  topic: 'Should teams publish unfinished work?',
  background: 'Your company wants faster internal feedback.',
  identity: 'Engineering manager',
  audience: 'Department leaders',
  objective: 'Recommend a policy.',
  conflict: 'Speed may expose avoidable mistakes.',
  structure: ['Position', 'Two reasons', 'Counterargument', 'Conclusion'],
  points: ['Early feedback reduces rework', 'Clear labels limit confusion'],
  keywords: ['iteration', 'transparency', 'trade-off'],
  opening: 'Unfinished work is risky, but hiding it is often riskier.',
};

test('场景 schema：接受且只规范化两类完整场景', () => {
  assert.deepEqual(validateSpeakingScene('multi_role', multiRole), multiRole);
  assert.deepEqual(validateSpeakingScene('impromptu', impromptu), impromptu);
});

test('场景 schema：拒绝未知类型、缺字段、空文本、错误结构和额外字段', () => {
  assert.throws(() => validateSpeakingScene('other', multiRole), /sceneType/);
  assert.throws(() => validateSpeakingScene('multi_role', { ...multiRole, conflict: ' ' }), /conflict/);
  assert.throws(() => validateSpeakingScene('multi_role', { ...multiRole, roles: [multiRole.roles[0]] }), /roles/);
  assert.throws(() => validateSpeakingScene('multi_role', { ...multiRole, roles: multiRole.roles.map((role) => ({ ...role, roleType: 'ally' })) }), /blocker/);
  assert.throws(() => validateSpeakingScene('multi_role', { ...multiRole, roles: multiRole.roles.map(({ roleType, ...role }) => role) }), /roleType/);
  assert.throws(() => validateSpeakingScene('multi_role', { ...multiRole, extra: true }), /extra/);
  assert.throws(() => validateSpeakingScene('impromptu', { ...impromptu, structure: 'Position' }), /structure/);
  assert.throws(() => validateSpeakingScene('impromptu', { ...impromptu, keywords: [] }), /keywords/);
});

test('场景 schema：拒绝超长文本、HTML、危险控制字符和超过 64KiB JSON', () => {
  assert.throws(() => validateSpeakingScene('multi_role', { ...multiRole, title: 'x'.repeat(121) }), /title/);
  assert.throws(() => validateSpeakingScene('impromptu', { ...impromptu, opening: 'x'.repeat(1001) }), /opening/);
  assert.throws(() => validateSpeakingScene('multi_role', { ...multiRole, title: '<b>unsafe</b>' }), /HTML/);
  assert.throws(() => validateSpeakingScene('impromptu', { ...impromptu, keywords: ['safe', 'bad\u0000value'] }), /控制字符/);
  assert.throws(() => validateSpeakingScene('impromptu', {
    ...impromptu,
    unexpected: '界'.repeat(22000),
  }), /64KiB/);
});
