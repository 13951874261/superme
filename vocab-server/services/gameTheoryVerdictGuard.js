const { evaluateVerdictSectionsQuality, countCompactChars } = require('./gtCaseQuality');

const SECTION_KEYS = [
  'interest_chain',
  'emotion_motives',
  'actionable_strategy',
  'script_examples',
];

const SECTION_LABELS = {
  interest_chain: '利益链',
  emotion_motives: '情绪动机',
  actionable_strategy: '可执行策略',
  script_examples: '话术示例',
};

function buildSectionFallback(key, sceneHint) {
  const label = SECTION_LABELS[key] || key;
  const hint = String(sceneHint || '当前高管斗争场景').slice(0, 80);
  return (
    `【系统补全·${label}】围绕「${hint}」：请把注意力放在多方利益、情绪与可执行动作上。` +
    '先标出谁赢谁输、谁恐惧谁要面子，再给出 1–2 步可落地动作与一句可直接说出口的得体话术。' +
    '补全内容仅作结构占位，正式研判应以模型完整四节为准。'
  );
}

function ensureGameTheoryVerdictSections(parsed, sceneHint) {
  const base = parsed && typeof parsed === 'object' ? { ...parsed } : {};
  let repaired = false;

  for (const key of SECTION_KEYS) {
    const cur = String(base[key] || '').trim();
    if (!cur) {
      base[key] = buildSectionFallback(key, sceneHint || base.suggestion);
      repaired = true;
    } else {
      base[key] = cur;
    }
  }

  const evalResult = evaluateVerdictSectionsQuality({
    interest_chain: base.interest_chain,
    emotion_motives: base.emotion_motives,
    actionable_strategy: base.actionable_strategy,
    script_examples: base.script_examples,
  });

  // 仍过短时继续垫长（保持 below_standard 标记）
  if (evalResult.sections_char_count < 600) {
    for (const key of SECTION_KEYS) {
      if (countCompactChars(SECTION_KEYS.map((k) => base[k]).join('')) >= 600) break;
      base[key] = `${base[key]}${buildSectionFallback(key, sceneHint)}`;
      repaired = true;
    }
  }

  const finalEval = evaluateVerdictSectionsQuality({
    interest_chain: base.interest_chain,
    emotion_motives: base.emotion_motives,
    actionable_strategy: base.actionable_strategy,
    script_examples: base.script_examples,
  });

  base.quality = repaired || finalEval.quality === 'below_standard' ? 'below_standard' : 'ok';
  if (repaired || finalEval.quality === 'below_standard') {
    base.quality_note =
      finalEval.quality_note ||
      (repaired ? '研判四节经系统补全，未达完整详实门槛（GT-CASE-02）' : undefined);
  } else {
    delete base.quality_note;
  }
  base.sections_char_count = finalEval.sections_char_count;

  const suggestion = String(base.suggestion || '').trim();
  if (!suggestion) {
    base.suggestion = [
      base.interest_chain,
      base.emotion_motives,
      base.actionable_strategy,
      base.script_examples,
    ]
      .map((s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40))
      .filter(Boolean)
      .join('｜');
    repaired = true;
    if (base.quality === 'ok') {
      // suggestion 兜底不单独把 ok 打成 below，除非原本缺节
    }
  }

  return base;
}

module.exports = {
  ensureGameTheoryVerdictSections,
  SECTION_KEYS,
  SECTION_LABELS,
};
