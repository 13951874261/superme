const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeToneCorrections } = require('../services/toneCorrections');

test('空数组兜底 1 行', () => {
  const r = normalizeToneCorrections([], '你没资格过问我的编制。');
  assert.equal(r.repaired, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].original, '你没资格过问我的编制。');
});

test('合法数组保留', () => {
  const r = normalizeToneCorrections([
    {
      original: '你没资格过问我的编制。',
      problem: '过硬',
      suggested: '编制安排我会同步边界，也想先听你的关切。',
    },
  ]);
  assert.equal(r.repaired, false);
  assert.equal(r.items.length, 1);
});

test('残缺项丢弃后兜底', () => {
  const r = normalizeToneCorrections([{ original: '只有原话' }], '备用原话');
  assert.equal(r.repaired, true);
  assert.equal(r.items[0].original, '备用原话');
});
