const https = require('https');

const LLM_URL = 'https://23.95.214.232/v1/chat/completions';
const LLM_MODEL = 'dify';
const REQUEST_TIMEOUT_MS = 60000;

function buildSystemPrompt(topic) {
  return `你是一个顶级跨国企业英语私教与语言学专家。
请从用户提供的长文中，提炼出最具商业价值、最体现高管专业度的高阶商务词汇和短语。
【当前主题】：${topic || '商务沟通'}

【核心约束】：
所提取的单词（words）和短语（phrases）必须强制与【当前主题】高度相关。如果输入文本中的词汇和短语与【当前主题】不相关，请予以忽略，只保留相关的。

【强制要求】：必须返回合法的 JSON 格式，不要包含 \`\`\`json 等 Markdown 标记，直接输出大括号包裹的内容。
返回的 JSON 必须严格遵循以下结构：
{
  "words": [
    {
      "word": "提取的核心单词",
      "phonetic": "音标",
      "pos": "词性(如 n., v., adj.)",
      "zh_meaning": "精炼的中文商务含义"
    }
  ],
  "phrases": [
    {
      "phrase": "提取的高频商务短语",
      "meaning": "中文含义"
    }
  ],
  "sentences": [
    "高阶实战例句1（必须包含上述提取的至少1个单词和1个短语，贴合外企高管语境）",
    "高阶实战例句2",
    "高阶实战例句3"
  ]
}

【提取规则】：
1. words 提取 10-20 个最具含金量的商务/逻辑类词汇（排除基础词汇如 market, company）。
2. phrases 提取 3-5 个地道短语（如 boil down to, align with）。
3. sentences 必须具有极强的职场实战压迫感或决策属性。`;
}

function buildUserPrompt(articleText) {
  return `【输入文本】：\n"""\n${articleText}\n"""`;
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
          const content = String(data?.choices?.[0]?.message?.content || '');
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
  const words = Array.isArray(raw?.words) ? raw.words : [];
  const phrases = Array.isArray(raw?.phrases) ? raw.phrases : [];
  const sentences = Array.isArray(raw?.sentences) ? raw.sentences : [];
  return {
    words: words.filter((w) => w && typeof w === 'object' && w.word).map((w) => ({
      word: String(w.word || ''),
      phonetic: w.phonetic ? String(w.phonetic) : undefined,
      pos: w.pos ? String(w.pos) : undefined,
      zh_meaning: w.zh_meaning ? String(w.zh_meaning) : undefined,
    })),
    phrases: phrases.filter((p) => p && typeof p === 'object' && p.phrase).map((p) => ({
      phrase: String(p.phrase || ''),
      meaning: String(p.meaning || ''),
    })),
    sentences: sentences.filter((s) => typeof s === 'string'),
  };
}

async function purifyVocabulary({ articleText = '', topic = '' }, apiKey) {
  if (!apiKey) throw new Error('Server missing VOCAB_PURIFY_LLM_API_KEY');
  if (!String(articleText || '').trim()) throw new Error('articleText is required');
  const raw = await callLLM(buildSystemPrompt(topic), buildUserPrompt(articleText), apiKey);
  return normalizeResult(raw);
}

module.exports = { purifyVocabulary, normalizeResult };