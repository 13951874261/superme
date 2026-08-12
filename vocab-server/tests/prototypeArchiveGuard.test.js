const assert = require('assert');
const { normalizePrototypeArchive } = require('../services/prototypeArchiveGuard');

const cases = [
  [{ name: '财务总监A', type: '利益驱动型', description: '关注短期业绩和资源交换' }, true],
  [{ name: '空降VP', type: '面子驱动型', description: '偏好公开施压' }, true],
  [{ name: '用户本人', type: '谨慎型', description: '这是对用户本人的性格描述' }, false],
  [{ name: '我的性格', type: '利益驱动型', description: '自我画像' }, false],
  [{ name: '我', type: '恐惧驱动型', description: '用户自我描述' }, false],
  [{ name: '', type: '利益驱动型', description: 'empty name' }, false],
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

console.log('OK prototypeArchiveGuard');