import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AESTHETICS_RULES_MIN,
  ensureMinRules,
  evaluateRulesTipQuality,
  normalizeRulesList,
} from './aestheticsRulesTips';

test('AESTHETICS_RULES_MIN 为 5', () => {
  assert.equal(AESTHETICS_RULES_MIN, 5);
});

test('normalizeRulesList 拆分中文句号', () => {
  assert.deepEqual(normalizeRulesList('甲。乙；丙'), ['甲', '乙', '丙']);
});

test('ensureMinRules 不足则补到 5', () => {
  const r = ensureMinRules(['只一条']);
  assert.equal(r.length, 5);
  assert.equal(r[0], '只一条');
});

test('evaluateRulesTipQuality：原有≥5 为 ok', () => {
  const five = ['a', 'b', 'c', 'd', 'e'];
  const q = evaluateRulesTipQuality(five);
  assert.equal(q.quality, 'ok');
  assert.equal(q.count, 5);
  assert.equal(q.rules.length, 5);
});

test('evaluateRulesTipQuality：原有 2 条为 below_standard 但 rules 补满 5', () => {
  const q = evaluateRulesTipQuality(['x', 'y']);
  assert.equal(q.quality, 'below_standard');
  assert.equal(q.count, 2);
  assert.equal(q.rules.length, 5);
});
