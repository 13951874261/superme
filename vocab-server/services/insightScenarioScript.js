const { extractJsonFromString } = require('./insightSpeakProxy');
const { countWords, estimateDurationMinutes, evaluateScriptDraft } = require('./scriptEvaluator');
const FALLBACK_BASE = require('./insightScenarioFallbacks.json');

function countScriptWords(draft) {
  const phases = draft && Array.isArray(draft.phases) ? draft.phases : [];
  return phases.reduce((sum, p) => sum + countWords(p && p.content), 0);
}

function evaluateQuality(minutes, scriptScore = 100) {
  const m = Number(minutes);
  const passedDuration = m >= 8 && m <= 12;
  const passedScript = Number(scriptScore) >= 85;
  return {
    passedDuration,
    passedScript,
    quality: (passedDuration && passedScript) ? 'ok' : 'below_standard',
  };
}

function evaluateFull(draft) {
  if (!draft || typeof draft !== 'object') {
    return {
      quality: 'below_standard',
      evaluation: {
        totalWords: 0,
        estimatedMinutes: 0,
        passedDuration: false,
        scriptScore: 0,
        passedScript: false,
      },
      report: null,
    };
  }

  const totalWords = countScriptWords(draft);
  const estimatedMinutes = estimateDurationMinutes(totalWords);
  const passedDuration = estimatedMinutes >= 8 && estimatedMinutes <= 12;
  const report = evaluateScriptDraft(draft);
  const scriptScore = report ? (Number(report.score) || 0) : 0;
  const passedScript = scriptScore >= 85 && Boolean(report && report.passed);
  const quality = (passedDuration && passedScript) ? 'ok' : 'below_standard';

  return {
    quality,
    evaluation: {
      totalWords,
      estimatedMinutes,
      passedDuration,
      scriptScore,
      passedScript,
    },
    report,
  };
}

function generateRetryHint(evaluation) {
  const totalWords = evaluation?.totalWords || 0;
  const scriptScore = evaluation?.scriptScore || 0;
  const passedDuration = Boolean(evaluation?.passedDuration);
  const passedScript = Boolean(evaluation?.passedScript);

  let failedDimension = 'both';
  if (!passedDuration && passedScript) failedDimension = 'duration';
  else if (passedDuration && !passedScript) failedDimension = 'score';
  else if (!passedDuration && !passedScript) failedDimension = 'both';

  return `上次生成未达标：totalWords=${totalWords}（需≥2100），scriptScore=${scriptScore}（需≥85），失败维度=${failedDimension}。请重新生成完整四幕对白，加强阶段三博弈与信息差。`;
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
  let selected = FALLBACK_BASE[cat];
  if (!selected) {
    if (cat.includes('体制')) selected = FALLBACK_BASE['体制内'];
    else if (cat.includes('外企')) selected = FALLBACK_BASE['外企'];
    else selected = FALLBACK_BASE['通用社交'] || FALLBACK_BASE['体制内'];
  }
  return JSON.parse(JSON.stringify(selected));
}

function buildScenarioResponse({ draft, answerText, category, retryCount = 0, evaluation, quality } = {}) {
  let finalDraft = draft;
  if (!finalDraft) {
    const text = String(answerText ?? '');
    const cat = String(category || '').trim();
    finalDraft = tryParseDraft(text);
    if (!finalDraft) {
      if (text.trim()) {
        finalDraft = wrapPlain(text, cat);
      } else {
        finalDraft = getFallbackDraft(cat || '通用社交');
      }
    }
  }

  const evalResult = evaluateFull(finalDraft);
  const finalEvaluation = evaluation || evalResult.evaluation;
  const finalQuality = quality || evalResult.quality;

  return {
    success: true,
    draft: finalDraft,
    evaluation: finalEvaluation,
    quality: finalQuality,
    retryCount: Number(retryCount) || 0,
    scenario: flattenDraft(finalDraft),
  };
}

module.exports = {
  countWords,
  countScriptWords,
  estimateDurationMinutes,
  evaluateQuality,
  evaluateFull,
  generateRetryHint,
  flattenDraft,
  wrapPlain,
  tryParseDraft,
  getFallbackDraft,
  buildScenarioResponse,
};
