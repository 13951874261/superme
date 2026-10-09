const { chatCompletions, extractJsonObject } = require('./openaiCompatLlm');

const REQUEST_TIMEOUT_MS = 45000;

function buildSystemPrompt() {
  return `???????????????????????????????? Why ????
?????????????????????????????????????????????
??????? JSON????? Markdown?
{
  "is_passed": true,
  "depth_score": 0,
  "layer_feedback": [
    {"level": 1, "verdict": "??????", "gap": "??????????"}
  ],
  "ultimate_law": "?????????",
  "suggestion": "???????????"
}
depth_score ??? 0-100 ????layer_feedback ???????`;
}

function buildUserPrompt(input) {
  const layers = Array.isArray(input.layers) ? input.layers : [];
  return [
    `????${String(input.event_text || '')}`,
    `??????${String(input.dimension || 'structure')}`,
    `????${String(input.scene_type || 'corp_clash')}`,
    `??????${String(input.game_model || 'prisoner_dilemma')}`,
    `??????${String(input.user_current_profile || '')}`,
    '???????',
    ...layers.map((layer, index) => `Why-${index + 1}: ${String(layer?.why || '')}`),
  ].join('\n');
}

async function callLLM(systemPrompt, userPrompt, apiKey) {
  const data = await chatCompletions({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    timeoutMs: REQUEST_TIMEOUT_MS,
    apiKey,
  });
  return extractJsonObject(data?.choices?.[0]?.message?.content || '');
}

function normalizeResult(raw) {
  const feedback = Array.isArray(raw?.layer_feedback) ? raw.layer_feedback : [];
  const score = Math.max(0, Math.min(100, Math.round(Number(raw?.depth_score) || 0)));
  return {
    is_passed: Boolean(raw?.is_passed) && score >= 60,
    depth_score: score,
    layer_feedback: Array.from({ length: 5 }, (_, index) => {
      const item = feedback[index] || {};
      return {
        level: index + 1,
        verdict: String(item.verdict || '???'),
        gap: String(item.gap || '??????????????????'),
      };
    }),
    ultimate_law: String(raw?.ultimate_law || ''),
    suggestion: String(raw?.suggestion || ''),
  };
}

async function analyzeAscension(input, apiKey) {
  if (!apiKey) throw new Error('Server missing ASCENSION_LLM_API_KEY');
  const raw = await callLLM(buildSystemPrompt(), buildUserPrompt(input), apiKey);
  return normalizeResult(raw);
}

module.exports = { analyzeAscension, normalizeResult, buildSystemPrompt, buildUserPrompt };
