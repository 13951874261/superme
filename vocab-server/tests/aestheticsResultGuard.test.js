const assert = require('node:assert/strict');
const test = require('node:test');
const {
  looksLikeVocabCrossover,
  ensureAestheticsResult,
} = require('../services/aestheticsResultGuard');

test('词典式反馈判定为串台', () => {
  assert.equal(
    looksLikeVocabCrossover('abandon /əˈbændən/ 词性：动词 复数形式 abandons 意思：放弃'),
    true
  );
});

test('正常社交点评不判串台', () => {
  assert.equal(
    looksLikeVocabCrossover('敬酒时杯口应低于主宾，体现分寸与体面，避免抢戏。此场合失分点在于祝词过长。'),
    false
  );
});

test('ensureAestheticsResult 对串台文案回落社交点评', () => {
  const r = ensureAestheticsResult(
    { feedback: 'phonetic /test/ 词性：名词', score: 8, is_passed: true },
    '政商务饭局与敬酒'
  );
  assert.equal(r.repaired, true);
  assert.match(r.feedback, /社交指数量化点评/);
  assert.match(r.feedback, /政商务饭局与敬酒/);
  assert.equal(r.score, 8);
  assert.equal(r.is_passed, true);
});

test('ensureAestheticsResult 保留合法点评', () => {
  const r = ensureAestheticsResult(
    { feedback: '杯口低于主宾，场合分寸得体，可再压缩祝词。', score: 7, is_passed: true },
    '政商务饭局与敬酒'
  );
  assert.equal(r.repaired, false);
  assert.match(r.feedback, /杯口/);
});
