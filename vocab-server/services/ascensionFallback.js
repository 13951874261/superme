const https = require('https');

const LLM_URL = 'https://23.95.214.232/v1/chat/completions';
const LLM_MODEL = 'dify';
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

function callLLM(systemPrompt, userPrompt, apiKey) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      stream: false,
    });
    const request = https.request(LLM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      rejectUnauthorized: false,
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`LLM HTTP ${response.statusCode}: ${raw.slice(0, 200)}`));
          return;
        }
        try {
          const payload = JSON.parse(raw);
          const text = String(payload?.choices?.[0]?.message?.content || '');
          const match = text.match(/\{[\s\S]*\}/);
          if (!match) throw new Error('LLM did not return JSON');
          resolve(JSON.parse(match[0]));
        } catch (error) {
          reject(new Error(`LLM parse failed: ${error.message}`));
        }
      });
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('LLM timeout')));
    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });
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
