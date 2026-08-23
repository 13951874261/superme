const {
  resolveInsightGenApiKey,
  buildInsightGenInputs,
  parseInsightGenAnswer,
  runDifyCompletion,
} = require('./insightSpeakProxy');
const {
  tryParseDraft,
  evaluateFull,
  getFallbackDraft,
  generateRetryHint,
  buildScenarioResponse,
  wrapPlain,
} = require('./insightScenarioScript');

async function generateInsightScenario({
  category,
  userId = 'default-user',
  env = process.env,
  runDify = runDifyCompletion,
} = {}) {
  const prepared = buildInsightGenInputs({ category });
  const apiKey = resolveInsightGenApiKey(env);
  const baseUrl = env.VITE_DIFY_API_BASE_URL || env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  let bestDraft = null;
  let bestEval = null;
  let bestScore = -1;
  let lastAnswerText = '';
  let retryCount = 0;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let answerText = '';
    const inputs = { ...prepared.inputs };
    let query = '';

    if (attempt > 1 && bestEval) {
      const hint = generateRetryHint(bestEval);
      query = hint;
      inputs.retry_hint = hint;
    }

    try {
      const data = await runDify({
        apiKey,
        baseUrl,
        inputs,
        userId,
        query,
      });
      answerText = parseInsightGenAnswer(data);
      lastAnswerText = answerText;
    } catch (difyErr) {
      console.warn(`[insight/scenario] attempt ${attempt} dify failed:`, difyErr.message);
      if (!apiKey || difyErr.statusCode === 503) {
        break;
      }
    }

    const draft = tryParseDraft(answerText);
    if (draft) {
      const evalResult = evaluateFull(draft);
      if (evalResult.quality === 'ok') {
        return {
          ...buildScenarioResponse({
            draft,
            category: prepared.category,
            retryCount: attempt - 1,
            evaluation: evalResult.evaluation,
            quality: evalResult.quality,
          }),
          source: 'dify',
        };
      }

      const compositeRank = (evalResult.evaluation.passedDuration ? 50 : 0) + (evalResult.evaluation.scriptScore || 0);
      if (compositeRank > bestScore) {
        bestScore = compositeRank;
        bestDraft = draft;
        bestEval = evalResult.evaluation;
        retryCount = attempt - 1;
      }
    }
  }

  if (bestDraft) {
    const evalResult = evaluateFull(bestDraft);
    return {
      ...buildScenarioResponse({
        draft: bestDraft,
        category: prepared.category,
        retryCount,
        evaluation: evalResult.evaluation,
        quality: 'below_standard',
      }),
      source: 'dify',
    };
  }

  if (lastAnswerText && lastAnswerText.trim()) {
    const draft = wrapPlain(lastAnswerText, prepared.category);
    const evalResult = evaluateFull(draft);
    return {
      ...buildScenarioResponse({
        draft,
        category: prepared.category,
        retryCount: Math.max(0, retryCount),
        evaluation: evalResult.evaluation,
        quality: 'below_standard',
      }),
      source: 'dify',
    };
  }

  const fallbackDraft = getFallbackDraft(prepared.category);
  const fallbackEval = evaluateFull(fallbackDraft);
  return {
    ...buildScenarioResponse({
      draft: fallbackDraft,
      category: prepared.category,
      retryCount: 0,
      evaluation: fallbackEval.evaluation,
      quality: 'ok',
    }),
    source: 'fallback',
  };
}

module.exports = { generateInsightScenario };
