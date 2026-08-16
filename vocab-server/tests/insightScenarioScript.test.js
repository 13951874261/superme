const assert = require('node:assert/strict');
const test = require('node:test');
const {
  countScriptWords,
  estimateDurationMinutes,
  evaluateQuality,
  flattenDraft,
  buildScenarioResponse,
  getFallbackDraft,
} = require('../services/insightScenarioScript');

test('estimateDurationMinutes 2000 字 = 8.0', () => {
  assert.equal(estimateDurationMinutes(2000), 8);
});

test('evaluateQuality [8,12] 为 ok', () => {
  assert.equal(evaluateQuality(8).quality, 'ok');
  assert.equal(evaluateQuality(7.9).quality, 'below_standard');
  assert.equal(evaluateQuality(12).quality, 'ok');
  assert.equal(evaluateQuality(12.1).quality, 'below_standard');
});

test('getFallbackDraft 三类均有 4 幕', () => {
  for (const cat of ['体制内', '外企', '通用社交']) {
    const d = getFallbackDraft(cat);
    assert.equal(d.phases.length, 4);
    assert.ok(countScriptWords(d) > 1500);
  }
});

test('buildScenarioResponse 对纯字符串包装并标 below_standard', () => {
  const res = buildScenarioResponse({ answerText: '很短的案例' });
  assert.equal(res.success, true);
  assert.equal(res.draft.phases[0].content, '很短的案例');
  assert.equal(res.quality, 'below_standard');
  assert.ok(String(res.scenario).includes('很短的案例'));
});
