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
  const interestChunk = '围绕董事长与CEO的赢家输家利益拉扯，阵营出局风险明显。'.repeat(8);
  const emotionChunk = '说明谁害怕失去编制与部门控制权、谁极度在乎面子。'.repeat(8);
  const actionChunk = '必须先私下与合规部门对账取证，再在周一闭门会上表态。'.repeat(8);
  const scriptChunk = '直接说台词原话：「关于重组方案，我建议先以审计底线为基准。」'.repeat(8);
  const r = ensureGameTheoryVerdictSections({
    interest_chain: interestChunk,
    emotion_motives: emotionChunk,
    actionable_strategy: actionChunk,
    script_examples: scriptChunk,
    suggestion: '综合建议：先保全证据再表态。',
    score: 8,
    is_success: true,
  });
  assert.equal(r.quality, 'ok');
  assert.ok(!r.quality_note);
  assert.ok(r.sections_char_count >= 600);
});
