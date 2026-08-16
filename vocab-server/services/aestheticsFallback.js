const https = require('https');
const LLM_URL = 'https://23.95.214.232/v1/chat/completions';
const LLM_MODEL = 'dify';
const REQUEST_TIMEOUT_MS = 45000;

function sysPrompt() {
  return [
    '你是高阶审美与跨文化社交研判专家，精通政商务礼仪、餐桌分寸、高端社交场合行为分析。',
    '请对用户提交的社交场景应对方案进行深度研判，识别得体之处与潜在失分点。',
    '严禁输出英语单词释义、音标、词性、复数/时态变化或词典条目；必须做社交礼仪点评。',
    '你必须强制输出严格的JSON格式（不带任何Markdown符号），确保前端可直接JSON.parse解析。',
    'JSON结构必须包含以下三个字段：',
    '- feedback（字符串）：100-250字的深度点评与避坑指南，中文输出，须围绕场合规则/分寸/禁忌。',
    '- score（数字）：0-10的评分。score >= 6 时 is_passed=true，否则 is_passed=false。',
    '- is_passed（布尔）：是否体面过关。',
  ].join('\n');
}

function userPrompt(scene, response) {
  return [
    '【场景类型】' + String(scene || ''),
    '【用户应对】' + String(response || ''),
  ].join('\n');
}

function callLLM(sys, usr, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
      ],
      temperature: 0.2,
      stream: false,
    });
    const req = https.request(LLM_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      rejectUnauthorized: false,
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('LLM HTTP ' + res.statusCode + ': ' + raw.slice(0, 200)));
        }
        try {
          const d = JSON.parse(raw);
          const text = String(d?.choices?.[0]?.message?.content || '');
          const m = text.match(/\{[\s\S]*\}/);
          if (!m) return reject(new Error('no JSON in LLM response'));
          resolve(JSON.parse(m[0]));
        } catch (e) {
          reject(new Error('LLM parse failed: ' + e.message));
        }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('LLM timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function normalize(r, sceneCategory) {
  const { ensureAestheticsResult } = require('./aestheticsResultGuard');
  const ensured = ensureAestheticsResult(r, sceneCategory);
  return {
    feedback: ensured.feedback,
    score: ensured.score,
    is_passed: ensured.is_passed,
  };
}

async function analyze(input, key) {
  if (!key) throw new Error('missing AESTHETICS_LLM_API_KEY');
  const raw = await callLLM(sysPrompt(), userPrompt(input.scene_category, input.user_response), key);
  return normalize(raw, input.scene_category);
}

module.exports = { analyze, normalize, sysPrompt, userPrompt };
