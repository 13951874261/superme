function extractJsonFromString(raw) {
  const rawStr = String(raw ?? '').trim();
  const jsonBlockMatch = rawStr.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }
  const startIdx = rawStr.indexOf('{');
  const endIdx = rawStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return rawStr.substring(startIdx, endIdx + 1).trim();
  }
  return rawStr.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function parseListenFeedback(data) {
  return String(
    data?.data?.outputs?.ai_feedback
    ?? data?.data?.outputs?.text
    ?? data?.answer
    ?? data?.message
    ?? ''
  );
}

function parseSpeakResult(raw) {
  const parsed = JSON.parse(extractJsonFromString(raw));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('speak result is not an object');
  }
  return {
    score: Number(parsed.score) || 0,
    critique: String(parsed.critique || ''),
    framework_analysis: String(parsed.framework_analysis || ''),
    revised_version: String(parsed.revised_version || '')
  };
}

function buildTimedInputs(inputs, profile) {
  const base = inputs && typeof inputs === 'object' ? { ...inputs } : {};
  base.user_current_profile = profile || '';
  if (!base._system_time) base._system_time = new Date().toISOString();
  if (base._system_timestamp_ms == null || base._system_timestamp_ms === '') {
    base._system_timestamp_ms = Date.now();
  }
  return base;
}

async function runDifyWorkflow({ apiKey, baseUrl, inputs, userId }) {
  if (!apiKey) {
    const err = new Error('后端未配置对应 Dify 密钥');
    err.statusCode = 503;
    throw err;
  }
  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs,
      response_mode: 'blocking',
      user: userId
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Dify 请求失败: ${response.status} - ${errText}`);
    err.statusCode = response.status;
    throw err;
  }
  return response.json();
}

function resolveInsightGenApiKey(env) {
  const source = env && typeof env === 'object' ? env : process.env;
  return String(source.DIFY_INSIGHT_GEN_KEY || source.VITE_DIFY_INSIGHT_GEN_KEY || '').trim();
}

function buildInsightGenInputs(body) {
  const category = String((body && body.category) || '').trim();
  if (!category) throw new Error('category required');
  return {
    category,
    inputs: { category }
  };
}

function parseInsightGenAnswer(data) {
  return String((data && data.answer) || '').trim();
}

async function runDifyCompletion({ apiKey, baseUrl, inputs, userId, query = '' }) {
  if (!apiKey) {
    const err = new Error('后端未配置对应 Dify 密钥');
    err.statusCode = 503;
    throw err;
  }
  const response = await fetch(`${String(baseUrl || '').replace(/\/$/, '')}/completion-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs,
      query,
      response_mode: 'blocking',
      user: userId
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Dify 请求失败: ${response.status} - ${errText}`);
    err.statusCode = response.status;
    throw err;
  }
  return response.json();
}

module.exports = {
  extractJsonFromString,
  parseListenFeedback,
  parseSpeakResult,
  buildTimedInputs,
  runDifyWorkflow,
  resolveInsightGenApiKey,
  buildInsightGenInputs,
  parseInsightGenAnswer,
  runDifyCompletion
};
