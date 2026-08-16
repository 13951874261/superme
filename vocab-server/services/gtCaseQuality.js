/** GT-CASE-02：与前端 gtCaseQuality.ts 同规则的服务端镜像 */

const GT_CASE_BG_MIN = 400;
const GT_VERDICT_SECTIONS_MIN = 600;
const GT_ROLE_HINT_RE =
  /董事长|CEO|COO|CFO|VP|总监|老板|下属|同事|投资人|董事|秘书|法务|创始人|大股东|总裁|经理/gi;

function countCompactChars(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

function countRoleHints(background) {
  const matches = String(background || '').match(GT_ROLE_HINT_RE);
  return matches ? matches.length : 0;
}

function evaluateCasePushQuality(caseLike) {
  const char_count = countCompactChars(caseLike?.background);
  const role_hints = countRoleHints(caseLike?.background || '');
  const incompleteOk = countCompactChars(caseLike?.incomplete_info) >= 20;
  const decisionOk = countCompactChars(caseLike?.decision_point) >= 20;
  const notes = [];
  if (char_count < GT_CASE_BG_MIN) {
    notes.push(`背景未达 ${GT_CASE_BG_MIN} 字详实门槛（当前 ${char_count}）`);
  }
  if (role_hints < 3) {
    notes.push(`角色线索不足 3 处（当前 ${role_hints}）`);
  }
  if (!incompleteOk) notes.push('未知信息不完整');
  if (!decisionOk) notes.push('决策点过短');
  if (notes.length === 0) {
    return { quality: 'ok', char_count, role_hints };
  }
  return {
    quality: 'below_standard',
    quality_note: notes.join('；') || '案例背景未达详实门槛（GT-CASE-02）',
    char_count,
    role_hints,
  };
}

function evaluateVerdictSectionsQuality(sections) {
  const parts = [
    sections?.interest_chain,
    sections?.emotion_motives,
    sections?.actionable_strategy,
    sections?.script_examples,
  ].map((s) => String(s || '').trim());
  const empty = parts.some((p) => !p);
  const sections_char_count = countCompactChars(parts.join(''));
  if (!empty && sections_char_count >= GT_VERDICT_SECTIONS_MIN) {
    return { quality: 'ok', sections_char_count };
  }
  const notes = [];
  if (empty) notes.push('研判四节有缺失');
  if (sections_char_count < GT_VERDICT_SECTIONS_MIN) {
    notes.push(`四节合计未达 ${GT_VERDICT_SECTIONS_MIN} 字（当前 ${sections_char_count}）`);
  }
  return {
    quality: 'below_standard',
    quality_note: notes.join('；') || '研判未达四节/字数门槛（GT-CASE-02）',
    sections_char_count,
  };
}

module.exports = {
  GT_CASE_BG_MIN,
  GT_VERDICT_SECTIONS_MIN,
  countCompactChars,
  countRoleHints,
  evaluateCasePushQuality,
  evaluateVerdictSectionsQuality,
};
