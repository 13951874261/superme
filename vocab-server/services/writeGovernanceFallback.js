const https = require('https');
const LLM_URL = process.env.WRITE_GOVERNANCE_LLM_URL || 'https://23.95.214.232/v1/chat/completions';
const LLM_MODEL = 'dify';
const REQUEST_TIMEOUT_MS = 45000;

function detectLanguage(text) {
  const value = String(text || '').trim();
  if (!value) return 'unknown';
  const chineseCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCount = (value.match(/[A-Za-z]/g) || []).length;
  if (chineseCount === 0 && latinCount === 0) return 'unknown';
  return chineseCount >= latinCount * 0.2 ? 'zh' : 'en';
}

function getSystemPrompt(taskType, language) {
  const common = [
    '你是顶级政商务写作教练、体制内公文专家和商业战略顾问。',
    '请对用户原文进行深度批改，必须返回严格JSON，禁止Markdown代码块和额外说明。',
  ];
  if (taskType === 'business_writing') {
    return common.concat([
      language === 'zh'
        ? '请重点分析中文商务写作的语气、逻辑、分寸、压缩效率与可执行性。'
        : 'Review the business writing for tone, logic, concision and executive-level impact.',
      '返回字段：tone_evaluation、compressed_text、skill_point、optimized_version。',
    ]).join('\n');
  }
  if (taskType === 'value_proposal') {
    return common.concat([
      language === 'zh'
        ? '请识别行政化表达中的低价值问题，提炼可迁移商业价值，并形成面向管理层的价值提案。'
        : 'Identify administrative weaknesses, extract transferable value, and produce an executive business proposal.',
      '返回字段：admin_flaws、value_extraction、business_proposal、optimized_version。',
    ]).join('\n');
  }
  return common.concat([
    language === 'zh'
      ? '请按中文公文批改标准审查：语法措辞、结构逻辑、政商务分寸、战略站位与合规风险。'
      : 'Review grammar, structure, executive tone, strategic positioning and compliance risk.',
    '返回字段：L1、L2、L3、optimized_version。',
    'L1为表层语法与措辞批改；L2为结构逻辑与商务分寸；L3为战略站位、政治敏感性和合规风险。',
  ]).join('\n');
}

function buildUserPrompt(taskType, originalText, additionalParams) {
  return [
    '【任务类型】' + String(taskType || 'document_correction'),
    '【原文】\n' + String(originalText || ''),
    additionalParams ? '【补充要求】\n' + String(additionalParams) : '',
  ].filter(Boolean).join('\n\n');
}

function extractJson(text) {
  const value = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM did not return JSON');
  return JSON.parse(match[0]);
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
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      rejectUnauthorized: false,
    }, response => {
      let raw = '';
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('LLM HTTP ' + response.statusCode + ': ' + raw.slice(0, 200)));
          return;
        }
        try {
          const payload = JSON.parse(raw);
          const content = String(payload?.choices?.[0]?.message?.content || '');
          resolve(extractJson(content));
        } catch (error) {
          reject(new Error('LLM parse failed: ' + error.message));
        }
      });
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('LLM timeout')));
    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });
}

function normalizeResult(raw, taskType) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const optimized = String(value.optimized_version || value.optimized || value.rewritten_text || '');
  if (taskType === 'business_writing') {
    return {
      tone_evaluation: String(value.tone_evaluation || value.L1 || ''),
      compressed_text: String(value.compressed_text || value.optimized_version || ''),
      skill_point: String(value.skill_point || value.L2 || ''),
      optimized_version: optimized,
    };
  }
  if (taskType === 'value_proposal') {
    return {
      admin_flaws: String(value.admin_flaws || value.L1 || ''),
      value_extraction: String(value.value_extraction || value.L2 || ''),
      business_proposal: String(value.business_proposal || value.L3 || ''),
      optimized_version: optimized,
    };
  }
  return {
    L1: String(value.L1 || value.level_1 || value.L1_Grammar || ''),
    L2: String(value.L2 || value.level_2 || value.L2_Business_Tone || ''),
    L3: String(value.L3 || value.level_3 || value.L3_Strategic_Position || ''),
    optimized_version: optimized,
  };
}

function isMeaningfulResult(result, taskType) {
  if (!result || typeof result !== 'object') return false;
  if (taskType === 'business_writing') {
    return Boolean(result.tone_evaluation || result.compressed_text || result.skill_point);
  }
  if (taskType === 'value_proposal') {
    return Boolean(result.admin_flaws || result.value_extraction || result.business_proposal);
  }
  return Boolean(result.L1 || result.L2 || result.L3 || result.optimized_version);
}

async function analyzeWriting(input, apiKey) {
  if (!apiKey) throw new Error('missing WRITE_GOVERNANCE_LLM_API_KEY');
  const taskType = String(input?.taskType || 'document_correction');
  const originalText = String(input?.originalText || '').trim();
  if (!originalText) throw new Error('originalText required');
  const language = detectLanguage(originalText);
  const raw = await callLLM(
    getSystemPrompt(taskType, language),
    buildUserPrompt(taskType, originalText, input?.additionalParams || ''),
    apiKey,
  );
  const result = normalizeResult(raw, taskType);
  if (!isMeaningfulResult(result, taskType)) {
    throw new Error('LLM returned empty writing analysis');
  }
  return result;
}

module.exports = {
  analyzeWriting,
  detectLanguage,
  getSystemPrompt,
  buildUserPrompt,
  normalizeResult,
  isMeaningfulResult,
};
