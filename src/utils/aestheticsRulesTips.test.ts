import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AESTHETICS_RULES_MIN,
  ensureMinRules,
  evaluateRulesTipQuality,
  nextSelectedAfterDailyPush,
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

test('每日场景到达时：未选中则自动选中，已选手动预设则不覆盖', () => {
  const daily = { id: 'daily-1' };
  const preset = { id: 'preset-wine' };
  assert.deepEqual(nextSelectedAfterDailyPush(null, daily), daily);
  assert.deepEqual(nextSelectedAfterDailyPush(preset, daily), preset);
  assert.deepEqual(nextSelectedAfterDailyPush(daily, daily), daily);
});

test('换一条：原先选的是旧每日场景则跟上，原先是预设则保留', () => {
  const oldDaily = { id: 'daily-1' };
  const nextDaily = { id: 'daily-2' };
  const preset = { id: 'preset-wine' };
  assert.deepEqual(nextSelectedAfterDailyPush(oldDaily, nextDaily, 'daily-1'), nextDaily);
  assert.deepEqual(nextSelectedAfterDailyPush(null, nextDaily, 'daily-1'), nextDaily);
  assert.deepEqual(nextSelectedAfterDailyPush(preset, nextDaily, 'daily-1'), preset);
});
