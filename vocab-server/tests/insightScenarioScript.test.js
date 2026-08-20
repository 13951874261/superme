const assert = require('node:assert/strict');
const test = require('node:test');
const {
  countScriptWords,
  estimateDurationMinutes,
  evaluateQuality,
  evaluateFull,
  generateRetryHint,
  flattenDraft,
  buildScenarioResponse,
  getFallbackDraft,
} = require('../services/insightScenarioScript');
const { evaluateScriptDraft } = require('../services/scriptEvaluator');

test('estimateDurationMinutes 2000 字 = 8.0', () => {
  assert.equal(estimateDurationMinutes(2000), 8);
});

test('evaluateQuality 双层门禁: 分钟 [8,12] 且 分数 >= 85 为 ok', () => {
  assert.equal(evaluateQuality(8, 85).quality, 'ok');
  assert.equal(evaluateQuality(7.9, 90).quality, 'below_standard');
  assert.equal(evaluateQuality(12, 85).quality, 'ok');
  assert.equal(evaluateQuality(12.1, 90).quality, 'below_standard');
  assert.equal(evaluateQuality(9, 84).quality, 'below_standard');
});

test('getFallbackDraft 三套独立题材均满足 8–10 分钟 (2100–2600字) 且 scriptScore ≥ 85', () => {
  for (const cat of ['体制内', '外企', '通用社交']) {
    const draft = getFallbackDraft(cat);
    assert.equal(draft.phases.length, 4);
    assert.ok(draft.characters.length >= 3, `${cat} 角色数需 >= 3`);
    assert.ok(draft.infoMatrix.length >= 2, `${cat} 信息差矩阵需 >= 2`);

    const words = countScriptWords(draft);
    assert.ok(words >= 2100 && words <= 2600, `${cat} 字数 ${words} 需落在 [2100, 2600] 区间`);

    const minutes = estimateDurationMinutes(words);
    assert.ok(minutes >= 8.0 && minutes <= 12.0, `${cat} 演播时长 ${minutes} 需在 [8, 12] 分钟合格带`);

    const report = evaluateScriptDraft(draft);
    assert.ok(report.score >= 85, `${cat} scriptScore ${report.score} 需 >= 85`);
    assert.equal(report.passed, true);

    const full = evaluateFull(draft);
    assert.equal(full.quality, 'ok');
  }
});

test('generateRetryHint 精确指出失败维度', () => {
  const hintBoth = generateRetryHint({ totalWords: 1500, scriptScore: 70, passedDuration: false, passedScript: false });
  assert.ok(hintBoth.includes('失败维度=both'));
  assert.ok(hintBoth.includes('totalWords=1500'));
  assert.ok(hintBoth.includes('scriptScore=70'));

  const hintDuration = generateRetryHint({ totalWords: 1900, scriptScore: 90, passedDuration: false, passedScript: true });
  assert.ok(hintDuration.includes('失败维度=duration'));

  const hintScore = generateRetryHint({ totalWords: 2200, scriptScore: 75, passedDuration: true, passedScript: false });
  assert.ok(hintScore.includes('失败维度=score'));
});

test('buildScenarioResponse 对纯字符串包装并标 below_standard', () => {
  const res = buildScenarioResponse({ answerText: '很短的案例' });
  assert.equal(res.success, true);
  assert.equal(res.draft.phases[0].content, '很短的案例');
  assert.equal(res.quality, 'below_standard');
  assert.equal(res.evaluation.passedDuration, false);
  assert.ok(String(res.scenario).includes('很短的案例'));
});

test('buildScenarioResponse 正确透传 retryCount 与 evaluation', () => {
  const fallback = getFallbackDraft('体制内');
  const res = buildScenarioResponse({ draft: fallback, category: '体制内', retryCount: 2 });
  assert.equal(res.success, true);
  assert.equal(res.quality, 'ok');
  assert.equal(res.retryCount, 2);
  assert.equal(res.evaluation.passedDuration, true);
  assert.equal(res.evaluation.passedScript, true);
});
