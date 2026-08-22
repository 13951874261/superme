const assert = require('assert');
const {
  normalizePrototypeArchive,
  isTestFixturePrototypeName,
  filterVisiblePrototypes,
} = require('../services/prototypeArchiveGuard');

const cases = [
  [{ name: '财务总监A', type: '利益驱动型', description: '关注短期业绩和资源交换' }, true],
  [{ name: '空降VP', type: '面子驱动型', description: '偏好公开施压' }, true],
  [{ name: '用户本人', type: '谨慎型', description: '这是对用户本人的性格描述' }, false],
  [{ name: '我的性格', type: '利益驱动型', description: '自我画像' }, false],
  [{ name: '我', type: '恐惧驱动型', description: '用户自我描述' }, false],
  [{ name: '', type: '利益驱动型', description: 'empty name' }, false],
  [{ name: 'E2E-VP-122046', type: '测试型', description: '夹具对手' }, false],
  [{ name: 'E2E-VP-127472', type: '测试型', description: '夹具对手' }, false],
  [{ name: 'E2E_BOT_01', type: '测试型', description: '下划线夹具' }, false],
  [null, false],
];

for (const [input, shouldPass] of cases) {
  const result = normalizePrototypeArchive(input);
  if (shouldPass) {
    assert.ok(result, 'expected valid: ' + JSON.stringify(input));
    assert.ok(result.name);
  } else {
    assert.strictEqual(result, null, 'expected rejected: ' + JSON.stringify(input));
  }
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

console.log('OK prototypeArchiveGuard');