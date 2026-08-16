const assert = require('node:assert/strict');
const test = require('node:test');
const { ensureGameTheoryVerdictSections } = require('../services/gameTheoryVerdictGuard');

test('缺节时补齐四节并标记 below_standard', () => {
  const r = ensureGameTheoryVerdictSections(
    { score: 7, is_success: true, suggestion: '' },
    '董事会突袭免职'
  );
  assert.ok(r.interest_chain && r.emotion_motives && r.actionable_strategy && r.script_examples);
  assert.match(r.interest_chain, /系统补全/);
  assert.equal(r.quality, 'below_standard');
  assert.ok(r.suggestion && r.suggestion.length > 0);
  assert.ok(r.sections_char_count >= 100);
});

test('完整长四节保留 ok', () => {
  const chunk = '围绕董事长、CEO与投资人的利益拉扯，说明谁怕失去编制、谁要面子，并给出可执行动作与话术。'.repeat(8);
  const r = ensureGameTheoryVerdictSections({
    interest_chain: chunk,
    emotion_motives: chunk,
    actionable_strategy: chunk,
    script_examples: chunk,
    suggestion: '综合建议：先保全证据再表态。',
    score: 8,
    is_success: true,
  });
  assert.equal(r.quality, 'ok');
  assert.ok(!r.quality_note);
  assert.ok(r.sections_char_count >= 600);
});
