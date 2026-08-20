const ALLOWED_SCENES = new Set(['policy', 'report', 'email', 'book']);

function extractJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').trim();
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]
    || (text.includes('{') && text.includes('}')
      ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
      : text.replace(/```json/gi, '').replace(/```/g, '').trim());
  return JSON.parse(candidate);
}

function createReadPenetrationAnalyzer({ apiKey, baseUrl, fetchImpl = fetch }) {
  return async function analyze({ sceneType, textInput, userId = 'default-user', userProfile = '', systemTime = '' }) {
    if (!ALLOWED_SCENES.has(sceneType)) {
      const error = new Error('无效的穿透读场景类型');
      error.statusCode = 400;
      throw error;
    }
    const normalizedText = String(textInput || '').trim();
    if (!normalizedText) {
      const error = new Error('请输入待分析文本');
      error.statusCode = 400;
      throw error;
    }
    if (!apiKey) {
      const error = new Error('服务端未配置 DIFY_READ_PENETRATION_KEY');
      error.statusCode = 500;
      throw error;
    }

    const response = await fetchImpl(`${String(baseUrl || '').replace(/\/$/, '')}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          scene_type: sceneType,
          text_input: normalizedText,
          user_current_profile: String(userProfile || ''),
          User_Current_Profile: String(userProfile || ''),
          _system_time: String(systemTime || ''),
          _system_timestamp_ms: Date.now(),
        },
        response_mode: 'blocking',
        user: String(userId || 'default-user'),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `穿透读工作流 HTTP ${response.status}`);
      error.statusCode = response.status || 502;
      throw error;
    }

    const raw = payload?.data?.outputs?.analysis_result
      ?? payload?.data?.outputs?.result
      ?? payload?.data?.outputs?.text
      ?? payload?.answer
      ?? payload?.message
      ?? '';
    try {
      return extractJson(raw);
    } catch {
      const error = new Error('AI 穿透解码失败，返回的不是有效 JSON');
      error.statusCode = 502;
      throw error;
    }
  };
}

module.exports = { createReadPenetrationAnalyzer, extractJson };
