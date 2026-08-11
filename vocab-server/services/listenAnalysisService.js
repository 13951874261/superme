const https = require('https');

const LLM_URL = 'https://23.95.214.232/v1/chat/completions';
const LLM_MODEL = 'dify';
const REQUEST_TIMEOUT_MS = 30000;

function buildSystemPrompt() {
  return '你是一位顶级的跨国企业行为心理学专家与高级英语听力教练。\n\n你将接收到两段文本：一段是用户盲听后口述的【用户草稿】，另一段是真实的【标准原文】。\n\n你的任务分为两步：\n第一步【听辨比对】：对比两者的差异，指出用户在哪里漏听、错听（特别是连读、弱读或生僻词）。\n第二步【弦外之音】：对【标准原文】"剥开表面看本质"，解析其中的弦外之音（Subtext）、权力动态和高阶黑话。\n\n【强制要求】：必须返回合法的 JSON 格式，直接输出大括号包裹的内容（绝不可有 ```json 的 markdown 标记）。\n返回的 JSON 结构必须严格如下：\n{\n  "comparison": {\n    "accuracy_score": "用户听写准确率（如 85%）",\n    "errors": [\n      {\n        "user_heard": "用户听错的词/句",\n        "actual_words": "正确的词/句",\n        "reason": "错误原因分析（如：连读失音、词汇不熟、逻辑误判等）"\n      }\n    ],\n    "coach_comment": "给用户的一句简短鼓励或听力提升建议"\n  },\n  "subtext_analysis": {\n    "surface_meaning": "原文的字面意思摘要",\n    "hidden_subtext": "弦外之音剖析（深层权力博弈、情绪或真实意图）",\n    "power_dynamics": "当前对话中的同盟、施压或阻力关系分析",\n    "key_jargons": [\n      { "word": "黑话/短语", "meaning": "在此语境下的真实含义" }\n    ]\n  }\n}';
}

function buildUserPrompt(userInput, standardText, theme) {
  return `【背景主题】${theme || '商务谈判'}\n\n【用户草稿】（What the user heard）：\n"""\n${userInput || ''}\n"""\n\n【标准原文】（The actual transcript）：\n"""\n${standardText || ''}\n"""`;
}

function callLLM(systemPrompt, userPrompt, apiKey) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      stream: false,
    });
    const req = https.request(LLM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`LLM HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
        try {
          const data = JSON.parse(raw);
          const content = data?.choices?.[0]?.message?.content || '';
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) return reject(new Error('LLM did not return JSON'));
          resolve(JSON.parse(match[0]));
        } catch (error) {
          reject(new Error(`LLM parse failed: ${error.message}`));
        }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('LLM timeout')));
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function normalizeResult(raw) {
  const errors = Array.isArray(raw?.comparison?.errors) ? raw.comparison.errors : [];
  const jargons = Array.isArray(raw?.subtext_analysis?.key_jargons) ? raw.subtext_analysis.key_jargons : [];
  return {
    comparison: {
      accuracy_score: String(raw?.comparison?.accuracy_score || '0%'),
      errors: errors.filter((e) => e && typeof e === 'object').map((e) => ({
        user_heard: String(e.user_heard || ''),
        actual_words: String(e.actual_words || ''),
        reason: String(e.reason || ''),
      })),
      coach_comment: String(raw?.comparison?.coach_comment || ''),
    },
    subtext_analysis: {
      surface_meaning: String(raw?.subtext_analysis?.surface_meaning || ''),
      hidden_subtext: String(raw?.subtext_analysis?.hidden_subtext || ''),
      power_dynamics: String(raw?.subtext_analysis?.power_dynamics || ''),
      key_jargons: jargons.filter((j) => j && typeof j === 'object').map((j) => ({
        word: String(j.word || ''),
        meaning: String(j.meaning || ''),
      })),
    },
  };
}

async function analyzeListening({ userInput = '', standardText = '', theme = '' }, apiKey) {
  if (!apiKey) throw new Error('Server missing LISTEN_LLM_API_KEY');
  if (!String(standardText || '').trim()) throw new Error('standardText is required');
  const raw = await callLLM(buildSystemPrompt(), buildUserPrompt(userInput, standardText, theme), apiKey);
  return normalizeResult(raw);
}

module.exports = { analyzeListening, normalizeResult, buildSystemPrompt, buildUserPrompt };