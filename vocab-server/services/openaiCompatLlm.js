const http = require('http');
const https = require('https');

const DEFAULT_LLM_URL = 'https://fetch.234124123.xyz/v1/chat/completions';
const DEFAULT_LLM_KEY = 'sk-aow2api-your-custom-key';
const DEFAULT_LLM_MODELS = ['mart-paid'];

function getLlmUrl() {
  return process.env.LLM_URL || process.env.WRITE_GOVERNANCE_LLM_URL || DEFAULT_LLM_URL;
}

function getLlmKey(override) {
  if (override) return override;
  return process.env.LISTEN_LLM_API_KEY || DEFAULT_LLM_KEY;
}

function getLlmModels() {
  const fromEnv = String(process.env.LLM_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_LLM_MODELS.slice();
}

function extractAssistantContent(data) {
  return String(data?.choices?.[0]?.message?.content || '');
}

function extractJsonObject(content) {
  let s = String(content || '').trim();
  // Strip common reasoning wrappers / fences before locating JSON
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();

  const match = s.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM did not return JSON');

  const candidate = match[0];
  try {
    return JSON.parse(candidate);
  } catch (err) {
    const fixed = candidate.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error(`LLM did not return JSON (${err.message})`);
    }
  }
}

function postOnce(url, apiKey, bodyObj, timeoutMs) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }

    const payload = JSON.stringify(bodyObj);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname);
    const insecureTls = process.env.LLM_INSECURE_TLS === '1'
      || process.env.LLM_INSECURE_TLS === 'true'
      || isIpHost;

    const req = transport.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      ...(isHttps && insecureTls ? { rejectUnauthorized: false } : {}),
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`LLM HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(raw || '{}'));
        } catch (err) {
          reject(new Error(`LLM parse failed: ${err.message}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error('LLM timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function chatCompletions({
  messages,
  temperature = 0.2,
  timeoutMs = 45000,
  apiKey,
  models,
  url,
} = {}) {
  const targetUrl = url || getLlmUrl();
  const key = getLlmKey(apiKey);
  const list = models && models.length ? models : getLlmModels();
  let lastErr;
  for (const model of list) {
    try {
      return await postOnce(targetUrl, key, {
        model,
        messages,
        temperature,
        stream: false,
      }, timeoutMs);
    } catch (err) {
      lastErr = err;
      console.warn(`[LLM] model ${model} failed:`, err.message);
    }
  }
  throw lastErr || new Error('All LLM models failed');
}

module.exports = {
  chatCompletions,
  extractAssistantContent,
  extractJsonObject,
  getLlmUrl,
  getLlmKey,
  getLlmModels,
  DEFAULT_LLM_URL,
  DEFAULT_LLM_KEY,
  DEFAULT_LLM_MODELS,
};
