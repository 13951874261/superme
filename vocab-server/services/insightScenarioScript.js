const { extractJsonFromString } = require('./insightSpeakProxy');
const FALLBACK_BASE = require('./insightScenarioFallbacks.json');

const CATEGORY_PREFIX = {
  体制内: '【体制内】',
  外企: '【外企】',
  通用社交: '【通用社交】',
};

function countWords(text) {
  if (!text) return 0;
  return String(text).replace(/\s+/g, '').length;
}

function countScriptWords(draft) {
  const phases = draft && Array.isArray(draft.phases) ? draft.phases : [];
  return phases.reduce((sum, p) => sum + countWords(p && p.content), 0);
}

function estimateDurationMinutes(words) {
  return Number((Number(words) / 250).toFixed(1));
}

function evaluateQuality(minutes) {
  const m = Number(minutes);
  const passedDuration = m >= 8 && m <= 12;
  return {
    passedDuration,
    quality: passedDuration ? 'ok' : 'below_standard',
  };
}

function emptyPhase(phaseId, content = '') {
  return {
    phaseId,
    title: `阶段${phaseId}`,
    targetDuration: '',
    targetWordsRange: '',
    targetRatio: 0.25,
    content,
  };
}

function flattenDraft(draft) {
  const lines = [];
  lines.push(`【场景】${(draft && draft.sceneTitle) || ''}`);
  if (draft && draft.sceneSummary) lines.push(draft.sceneSummary);
  for (const c of (draft && draft.characters) || []) {
    lines.push(
      `【角色】${c.name}（${c.roleTitle}）表层：${c.surfaceGoal}；底牌：${c.hiddenMotive}；红线：${c.redLine}；赢面：${c.winCondition}`
    );
  }
  for (const p of (draft && draft.phases) || []) {
    lines.push(`【${p.title || `阶段${p.phaseId}`}】`);
    lines.push(p.content || '');
  }
  return lines.join('\n').trim();
}

function wrapPlain(text, category = '') {
  const body = String(text || '').trim() || '（空案例）';
  return {
    sceneTitle: category ? `【${category}】动态案例` : '动态案例',
    sceneSummary: '由纯文本案例包装的最小结构化草稿',
    characters: [],
    infoMatrix: [],
    phases: [
      emptyPhase(1, body),
      emptyPhase(2),
      emptyPhase(3),
      emptyPhase(4),
    ],
  };
}

function tryParseDraft(answerText) {
  try {
    const raw = extractJsonFromString(answerText);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (!Array.isArray(parsed.phases) || parsed.phases.length !== 4) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getFallbackDraft(category) {
  const cat = String(category || '').trim();
  const prefix = CATEGORY_PREFIX[cat] || (cat ? `【${cat}】` : '【通用社交】');
  const draft = JSON.parse(JSON.stringify(FALLBACK_BASE));
  const baseTitle = String(draft.sceneTitle || '').replace(/^【[^】]+】/, '');
  draft.sceneTitle = `${prefix}${baseTitle}`;
  return draft;
}

function buildScenarioResponse({ answerText, category } = {}) {
  const text = String(answerText ?? '');
  const cat = String(category || '').trim();

  let draft = tryParseDraft(text);
  if (!draft) {
    if (text.trim()) {
      draft = wrapPlain(text, cat);
    } else {
      draft = getFallbackDraft(cat || '通用社交');
    }
  }

  const totalWords = countScriptWords(draft);
  const estimatedMinutes = estimateDurationMinutes(totalWords);
  const { passedDuration, quality } = evaluateQuality(estimatedMinutes);

  return {
    success: true,
    draft,
    evaluation: {
      totalWords,
      estimatedMinutes,
      passedDuration,
    },
    quality,
    scenario: flattenDraft(draft),
  };
}

module.exports = {
  countScriptWords,
  estimateDurationMinutes,
  evaluateQuality,
  flattenDraft,
  wrapPlain,
  tryParseDraft,
  getFallbackDraft,
  buildScenarioResponse,
};
