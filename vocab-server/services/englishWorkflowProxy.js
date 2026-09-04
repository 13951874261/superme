function injectSystemDefaults(inputs = {}) {
  const base = typeof inputs === 'object' && inputs !== null ? { ...inputs } : {};
  if (!base._system_time) base._system_time = new Date().toISOString();
  if (base._system_timestamp_ms == null || base._system_timestamp_ms === '') base._system_timestamp_ms = Date.now();
  return base;
}

function ensureConfigured(apiKey) {
  if (apiKey) return;
  const error = new Error('服务端未配置该 workflow 的 API Key');
  error.statusCode = 500;
  throw error;
}

function parseResponse(response) {
  return response.json().catch(() => ({})).then((payload) => {
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `workflow HTTP ${response.status}`);
      error.statusCode = response.status || 502;
      throw error;
    }
    return payload;
  });
}

function createWorkflowRunner({ apiKey, baseUrl, fetchImpl = fetch }) {
  const trimmedBaseUrl = String(baseUrl || '').replace(/\/$/, '');
  return async function run({ inputs = {}, userId = 'default-user', responseMode = 'blocking', rawResponse = false, signal } = {}) {
    ensureConfigured(apiKey);
    const response = await fetchImpl(`${trimmedBaseUrl}/workflows/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: injectSystemDefaults(inputs), response_mode: responseMode, user: String(userId || 'default-user') }),
      signal,
    });
    if (rawResponse || responseMode === 'streaming') {
      return response;
    }
    return parseResponse(response);
  };
}

function createWorkflowUploader({ apiKey, baseUrl, fetchImpl = fetch }) {
  const trimmedBaseUrl = String(baseUrl || '').replace(/\/$/, '');
  return async function upload({ inputs = {}, userId = 'default-user', responseMode = 'blocking', file } = {}) {
    ensureConfigured(apiKey);
    if (!file || !file.buffer || !file.buffer.length) {
      const error = new Error('缺少音频文件');
      error.statusCode = 400;
      throw error;
    }
    const form = new FormData();
    form.append('inputs', JSON.stringify(injectSystemDefaults(inputs)));
    form.append('response_mode', responseMode);
    form.append('user', String(userId || 'default-user'));
    form.append('file', new Blob([file.buffer], { type: file.mimetype || 'audio/webm' }), file.originalname || 'speech.webm');
    const response = await fetchImpl(`${trimmedBaseUrl}/workflows/run`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    return parseResponse(response);
  };
}

module.exports = { createWorkflowRunner, createWorkflowUploader, injectSystemDefaults };